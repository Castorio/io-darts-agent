#!/bin/bash

# IO-Darts-Agent - Release Script
# Usage: ./scripts/create-release.sh [version]
# Example: ./scripts/create-release.sh 1.0.0

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     IO-Darts-Agent - Release Creator      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# Get version from argument or package.json
if [ -n "$1" ]; then
    VERSION="$1"
else
    VERSION=$(node -p "require('./package.json').version")
fi

echo -e "${YELLOW}Version: ${VERSION}${NC}"
echo ""

# Check if we're on main/master branch
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ] && [ "$BRANCH" != "master" ]; then
    echo -e "${YELLOW}⚠️  Warning: Not on main/master branch (current: $BRANCH)${NC}"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo -e "${RED}❌ Error: Uncommitted changes detected${NC}"
    echo "Please commit or stash your changes before creating a release."
    exit 1
fi

# Update version in package.json if different
CURRENT_VERSION=$(node -p "require('./package.json').version")
if [ "$VERSION" != "$CURRENT_VERSION" ]; then
    echo -e "${BLUE}📝 Updating version in package.json...${NC}"
    npm version "$VERSION" --no-git-tag-version
    git add package.json package-lock.json
    git commit -m "chore: bump version to $VERSION"
fi

# Create and push tag
echo -e "${BLUE}🏷️  Creating git tag v${VERSION}...${NC}"
git tag -a "v${VERSION}" -m "Release v${VERSION}"

echo -e "${BLUE}📤 Pushing tag to GitHub...${NC}"
git push origin "v${VERSION}"

echo ""
echo -e "${GREEN}✅ Release v${VERSION} created!${NC}"
echo ""
echo -e "${YELLOW}GitHub Actions will now build the installers automatically.${NC}"
echo -e "Watch progress at: ${BLUE}https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/actions${NC}"
echo ""
echo -e "Once complete, the release will be available at:"
echo -e "${BLUE}https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/releases/tag/v${VERSION}${NC}"
