import { DurableObject } from "cloudflare:workers";

const EMPTY_BOARD = () => Array.from({ length: 9 }, () => null);

function lines() {
  return [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
}

function winnerOf(board) {
  for (const [a, b, c] of lines()) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  if (board.every(Boolean)) return "draw";
  return null;
}

function emptyGame(title) {
  return {
    title: title || "Tic-tac-toe",
    board: EMPTY_BOARD(),
    turn: "X",
    winner: null,
    revision: 1,
    lastModified: Date.now(),
  };
}

export class Gadget extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.subscribers = new Map();
    this.mutationQueue = Promise.resolve();
  }

  enqueueMutation(fn) {
    const result = this.mutationQueue.then(fn);
    this.mutationQueue = result.catch(() => {});
    return result;
  }

  async loadGame() {
    const game = await this.ctx.storage.get("game");
    if (game && typeof game === "object" && Array.isArray(game.board) && game.board.length === 9) {
      return {
        ...emptyGame(game.title),
        ...game,
        board: game.board.map((cell) => (cell === "X" || cell === "O" ? cell : null)),
        turn: game.turn === "O" ? "O" : "X",
        winner: game.winner === "X" || game.winner === "O" || game.winner === "draw" ? game.winner : null,
      };
    }
    return emptyGame();
  }

  async getGame() {
    return this.loadGame();
  }

  setGame(state) {
    return this.enqueueMutation(() => this.setGameLocked(state));
  }

  async setGameLocked(state) {
    const current = await this.loadGame();
    const title =
      state && typeof state.title === "string" && state.title.trim()
        ? state.title.trim().slice(0, 80)
        : current.title;
    const board = Array.isArray(state?.board) && state.board.length === 9
      ? state.board.map((cell) => (cell === "X" || cell === "O" ? cell : null))
      : EMPTY_BOARD();
    const game = {
      title,
      board,
      turn: state?.turn === "O" ? "O" : "X",
      winner: winnerOf(board),
      revision: (current.revision || 0) + 1,
      lastModified: Date.now(),
    };
    if (game.winner) game.turn = current.turn;
    await this.ctx.storage.put("game", game);
    await this.broadcast({ type: "snapshot", game });
    return game;
  }

  move(index, mark) {
    return this.enqueueMutation(async () => {
      const current = await this.loadGame();
      const i = Number(index);
      const who = mark === "O" ? "O" : "X";
      if (current.winner || i < 0 || i > 8 || current.board[i] || who !== current.turn) {
        return current;
      }
      const board = current.board.slice();
      board[i] = who;
      const winner = winnerOf(board);
      const game = {
        ...current,
        board,
        turn: winner ? who : who === "X" ? "O" : "X",
        winner,
        revision: current.revision + 1,
        lastModified: Date.now(),
      };
      await this.ctx.storage.put("game", game);
      await this.broadcast({ type: "snapshot", game });
      return game;
    });
  }

  reset() {
    return this.enqueueMutation(async () => {
      const current = await this.loadGame();
      const game = emptyGame(current.title);
      game.revision = current.revision + 1;
      await this.ctx.storage.put("game", game);
      await this.broadcast({ type: "snapshot", game });
      return game;
    });
  }

  async subscribe(callback) {
    const dup = callback.dup();
    this.subscribers.set(dup, true);
    dup.onRpcBroken(() => {
      this.subscribers.delete(dup);
    });
    return this.loadGame();
  }

  async broadcast(event) {
    const calls = [];
    for (const [stub] of this.subscribers) {
      calls.push(
        Promise.resolve(stub.operation(event)).catch(() =>
          this.subscribers.delete(stub),
        ),
      );
    }
    await Promise.all(calls);
  }
}
