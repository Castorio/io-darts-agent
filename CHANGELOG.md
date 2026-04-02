# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### Game Display Module - Player-Specific Animations
- **New "Players" configuration tab** for configuring individual animations per player
- Players can have unique animations for the following events:
  - **180**: Custom animation when the player throws 180
  - **Leg Win**: Custom animation when the player wins a leg
  - **Set Win**: Custom animation when the player wins a set
  - **Match Win**: Custom animation when the player wins the match
  - **Checkout**: Custom animation when the player checks out
- **Multiple media types supported**: Built-in animations, GIF, Video
- **Custom sound support**: Each animation can have its own sound file (MP3, WAV, etc.)
- **Override mechanism**: Player-specific animations override global animations when that player is on throw
- **Fallback system**: If no player animation is configured, the global animation is used

#### Animation System Enhancements
- Extended animation events: 180, Bull, Double Bull, High Score, Bust, Checkout, Leg Win, Set Win, Match Win
- Configurable high score threshold (default: 140)
- Improved animation triggering based on player identification (by ID, name, or index)

### Changed

- Enhanced `GameDisplayHandler` to support player-specific animation resolution
- Updated configuration UI with new "Players" tab for animation management
- Improved animation lookup logic: searches by player ID first, then by name, then by index

### Technical Details

- New types: `PlayerAnimationConfig`, `PlayerAnimations` in `modules/game-display/src/types.ts`
- New function: `resolveAnimation()` for determining the correct animation based on event and player
- Player animations are stored in `config.playerAnimations[]` array

## [1.0.0] - 2024-03-30

### Added

- Win animation system with configurable effects
- Module configuration UI improvements
- Comprehensive documentation

### Previous Releases

See git history for changes before version 1.0.0.
