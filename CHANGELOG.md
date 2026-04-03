# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-04-03

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

#### Win Animation System
- **Configurable win animations** for Leg Win, Set Win, and Match Win events
- **Win animation options**:
  - Show Winner Name - Displays the player's name
  - Show Statistics - Displays Average, Darts, Checkout%, 180s
  - Effect - None / Confetti / Fireworks / Sparkles
  - Background Color - Configurable background color
  - Text Color - Configurable text color
- **Correct winner name resolution** from Autodarts match data at the moment of leg win

#### Animation System Enhancements
- Extended animation events: 180, Bull, Double Bull, High Score, Bust, Checkout, Leg Win, Set Win, Match Win
- Configurable high score threshold (default: 140)
- Improved animation triggering based on player identification (by ID, name, or index)

#### Match Results Display
- **Match results table** with chalkboard and statistics after match ends
- **Configurable display duration**: auto-hide after X seconds or manual dismiss
- Statistics include: Average, Darts thrown, Checkout percentage, 180s count

### Changed

- Enhanced `GameDisplayHandler` to support player-specific animation resolution
- Updated configuration UI with new "Players" tab for animation management
- Improved animation lookup logic: searches by player ID first, then by name, then by index
- Win animation now shows correct player name from the Autodarts event data

### Fixed

- **Leg win animation** now shows the correct winner name (fetched from Autodarts data at the moment of win)
- Player identification during win events now uses data from the current match state

### Technical Details

- New types: `PlayerAnimationConfig`, `PlayerAnimations` in `modules/game-display/src/types.ts`
- New function: `resolveAnimation()` for determining the correct animation based on event and player
- Player animations are stored in `config.playerAnimations[]` array
- Win animation configuration stored in `config.legWin`, `config.setWin`, `config.matchWin`

---

## [1.0.0] - 2024-03-30

### Added

- Win animation system with configurable effects
- Module configuration UI improvements
- Comprehensive documentation

### Previous Releases

See git history for changes before version 1.0.0.
