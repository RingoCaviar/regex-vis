# Drag nodes to edit a regular expression

## Requirements

- Dragging a node over a valid drop position previews the graph arrangement that would result from dropping it.
- Dropping commits the previewed node move and updates the textual regular expression once.
- Nodes can move between the regex body, groups, lookarounds, and choice branches.
- A compound node moves as one node and cannot be moved into itself or one of its descendants.
- Empty groups and lookarounds remain valid after their nodes move away. Unrelated pre-existing empty alternatives are preserved.
- Dragging a selected contiguous block from one node sequence moves that block. Otherwise, only the pressed node moves.
- Dragging a node starts a node move whether or not it is selected. Dragging an unselected group or graph whitespace starts box selection; dragging a selected group moves the group.
- Invalid drops and Escape cancel the move.
- Pointer events support mouse, touch, and pen input.
- A click without pointer movement selects a node; dragging begins only after the pointer crosses a movement threshold.
- Drop positions are hidden and do not intercept box selection until a node drag begins.
- An active node drag shows only the nearest valid position: a blue insertion marker or a labelled purple `OR` marker.
- The current drop candidate uses a switching margin so small pointer movements and preview reflow do not make it flicker between positions.
- Valid drop positions and their screen geometry are frozen when dragging starts. The preview is display-only and cannot move or create interactive drop positions during that drag.
- Every preview is derived from the committed AST rather than from the previous preview.
- Pointer movement is coalesced to one update per animation frame. Scrolling or resizing cancels the drag because it invalidates the frozen screen geometry.
- Moving outside the candidate radius hides the position and cancels the preview.
- Dropping on an `OR` position creates a choice or adds a branch to an existing choice.
- Moving the final node out of a choice branch removes that empty branch; a choice with one remaining branch is folded away.

## Test seams

- The AST node-move module: given an AST, dragged node IDs, and a drop position, it checks validity without cloning and can return the resulting AST without mutating the input.
- The rendered application: dropping a graph node changes the regex input to the generated expression.
- The launcher CLI: start, status, and stop work when the project path contains spaces.
