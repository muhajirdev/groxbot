const gadget = new Gadget(__ctx, {});
gadgetRef = gadget;
if (Array.isArray(savedMeta.undo) && savedMeta.undo.length) {
  gadget.undoStack = savedMeta.undo;
}
if (Array.isArray(savedMeta.redo) && savedMeta.redo.length) {
  gadget.redoStack = savedMeta.redo;
}
