# Claude Plugin Marketplace (viteinfinite)

A small marketplace for installing the skills in this repository as Claude plugins.

## Marketplace

Marketplace name: `viteinfinite-claude-marketplace`

## Plugins

- `coding`: Skill pack for commit messages and documentation updates

## Install

Add the marketplace from GitHub:

```shell
/plugin marketplace add viteinfinite/claude-plugin-marketplace
```

Install a plugin:

```shell
/plugin install coding@viteinfinite-claude-marketplace
```

## Direct clone (coding skills only)

Clone only the contents of the `coding` folder to your current directory (excluding `.claude-plugin`):

```shell
mkdir -p .claude/skills/
git clone --depth 1 --filter=blob:none --sparse https://github.com/viteinfinite/claude-plugin-marketplace temp_repo
cd temp_repo
git sparse-checkout set coding
rm -rf coding/.claude-plugin
mv coding/* ../.claude/skills/
cd ..
rm -rf temp_repo
```

## Local testing

```shell
/plugin marketplace add ./
/plugin install coding@viteinfinite-claude-marketplace
```
