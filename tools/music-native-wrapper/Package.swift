// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "NovaMusicNativeWrapper",
    platforms: [
        .macOS(.v12),
        .iOS(.v15)
    ],
    products: [
        .library(name: "NovaMusicNativeWrapper", targets: ["NovaMusicNativeWrapper"]),
        .executable(name: "MusicStudioNativeApp", targets: ["MusicStudioNativeApp"])
    ],
    targets: [
        .target(
            name: "NovaMusicNativeWrapper",
            path: ".",
            exclude: ["Tests", "MusicStudioApp.swift", "MusicStudioRootView.swift"],
            sources: [
                "CoreMidiInputBridge.swift",
                "MusicStudioWebMidiBridge.swift",
                "NativeMidiCoordinator.swift",
                "MusicStudioAppConfiguration.swift",
                "MusicStudioWebViewHost.swift"
            ]
        ),
        .executableTarget(
            name: "MusicStudioNativeApp",
            dependencies: ["NovaMusicNativeWrapper"],
            path: ".",
            exclude: [
                "Tests",
                "CoreMidiInputBridge.swift",
                "MusicStudioWebMidiBridge.swift",
                "NativeMidiCoordinator.swift",
                "MusicStudioAppConfiguration.swift",
                "MusicStudioWebViewHost.swift"
            ],
            sources: ["MusicStudioApp.swift", "MusicStudioRootView.swift"]
        ),
        .testTarget(
            name: "NovaMusicNativeWrapperTests",
            dependencies: ["NovaMusicNativeWrapper"],
            path: "Tests"
        )
    ]
)
