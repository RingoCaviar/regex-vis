# [Regex Vis](https://regex-vis.com)
🎨 Regex visualizer & editor

## Preview
![regex-vis](https://user-images.githubusercontent.com/27432981/180222745-da4671c6-8e0e-44f2-818f-25d5fa237956.gif)


## Features
- Visualizing regular expressions
- Visual editing of regular expressions
- Testing of regular expressions.

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

