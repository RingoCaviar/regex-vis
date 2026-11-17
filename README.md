# [Regex Vis](https://regex-vis.com)
🎨 Regex visualizer & editor

## Preview
![regex-vis](https://user-images.githubusercontent.com/27432981/180222745-da4671c6-8e0e-44f2-818f-25d5fa237956.gif)


## Features
- Visualizing regular expressions
- Visual editing of regular expressions
- Testing of regular expressions.

Graph selection supports clicking and dragging a selection box. Hold **Shift**
to add nodes or **Ctrl** to remove nodes from the selection (Ctrl takes priority
when both are held). Box selection uses the modifier held when the drag starts.
Non-consecutive nodes can be selected and deleted together; grouping, insertion,
and other combined edits require consecutive nodes in the same sequence.

### Matching engines

Open the **Test** tab and select **Default (JavaScript)** or **Clash Verge
(Mihomo)**. The choice is saved locally and included in copied test links.
Mihomo mode runs the actual `regexp2 v1.12.0` engine as WebAssembly, using the
same default options and backtick-separated filter alternatives as Mihomo.
For example, `美国\b` matches `美国111` in JavaScript mode and does not match
in Mihomo mode. Enter the regex value itself, without YAML keys or quotes.
The editor also accepts `/pattern/flags` notation in either mode; copied links
use this notation to retain checkbox flags.

Both engines run locally in a worker. Tests have time limits so an expensive
expression cannot freeze the page. The `i`, `m`, and `s` controls are supported;
`g` does not change an existence test. Mihomo mode reports unsupported flags
instead of approximating them. This tests the regex predicate, not provider
inclusion, renaming, or other Clash configuration rules.

The graph editor still supports its existing JavaScript syntax subset. If it
cannot draw an expression (such as `(?i)us`), the Test tab evaluates the original
input with the chosen engine and reports any engine errors separately.

The compiled engine and runtime are checked in, so normal builds only need Node.
To rebuild the WebAssembly asset with Go 1.24 or newer (the checked-in build uses
Go 1.27.4), run `pnpm build:regexp2`. `GO_BINARY` can point to a specific Go binary.
Sources, locked dependencies, and checksums are in `engines/regexp2`; third-party
licenses accompany the runtime in `src/regex-engine/vendor`.

## Blog
- [English](https://www.bowencodes.com/post/regex-vis_en)
- [Chinese](https://www.bowencodes.com/post/regex-vis)

## Contribution Guide

[Contribution Guide](https://github.com/Bowen7/regex-vis/blob/master/.github/CONTRIBUTING.md)

### Windows launcher

Double-click `regex-vis.cmd` to open a persistent server-control menu. It can
start the development server, open the browser, stop the server, show status and
logs, and install dependencies. It automatically selects a free port starting
at 5173.

The same actions are available from a terminal:

```powershell
.\regex-vis.cmd start
.\regex-vis.cmd status
.\regex-vis.cmd stop
```

### Node.js 16 compatibility tests

Prepare the repository-local Node.js 16 and pnpm test environment, then reuse
it for later compatibility runs:

```powershell
.\test-node16.ps1 prepare
.\test-node16.ps1 test
.\test-node16.ps1 status
```

The downloaded runtime is stored in `.test-runtime` and is not committed.

## Feedback

- [Report a bug](https://github.com/Bowen7/regex-vis/issues)
- You can also [open a new discussion](https://github.com/Bowen7/regex-vis/discussions) to ask questions about this repository or get help.

## License

[MIT](https://choosealicense.com/licenses/mit/)

## Thanks

This project is tested with BrowserStack.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=bowen7/regex-vis&type=Date)](https://star-history.com/#bowen7/regex-vis&Date)

