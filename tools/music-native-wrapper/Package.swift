// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "NovaMusicNativeWrapper",
    platforms: [
        .macOS(.v12),
        .iOS(.v15)
    ],
    products: [
        .library(name: "NovaMusicNativeWrapper", targets: ["NovaMusicNativeWrapper"])
    ],
    targets: [
        .target(
            name: "NovaMusicNativeWrapper",
            path: ".",
            exclude: ["Tests"],
            sources: [
                "CoreMidiInputBridge.swift",
                "MusicStudioWebMidiBridge.swift",
                "NativeMidiCoordinator.swift",
                "MusicStudioAppConfiguration.swift",
                "MusicStudioWebViewHost.swift"
            ]
        ),
        .testTarget(
            name: "NovaMusicNativeWrapperTests",
            dependencies: ["NovaMusicNativeWrapper"],
            path: "Tests"
        )
    ]
)
