// swift-tools-version: 6.0
import PackageDescription

let package = Package(
  name: "GroxbotKit",
  platforms: [
    .macOS(.v14),
    .iOS(.v17),
  ],
  products: [
    .library(name: "GroxbotKit", targets: ["GroxbotKit"])
  ],
  targets: [
    .target(name: "GroxbotKit"),
    .testTarget(
      name: "GroxbotKitTests",
      dependencies: ["GroxbotKit"]
    ),
  ]
)
