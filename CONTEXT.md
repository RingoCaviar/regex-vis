# Regex Visualization

Regex Vis presents a regular expression as an editable graph while keeping the graph and textual expression equivalent.

## Language

**Node**:
A visible, movable unit of a regular expression graph. A compound node can contain one or more node sequences.

**Node sequence**:
An ordered list of sibling nodes whose order determines concatenation order. The regex body, a group body, a lookaround body, and each choice branch are node sequences.
_Avoid_: Row, lane

**Node container**:
A regex, group, lookaround, or choice node that owns one or more node sequences.
_Avoid_: Parent box

**Drag preview**:
A temporary graph arrangement showing the exact result of the current valid drop position without changing the committed expression or its undo history.
_Avoid_: Live edit

**Drop position**:
A visible location where dragged nodes can be inserted. A position between siblings preserves concatenation; a position above or below a node sequence creates an alternative branch.
_Avoid_: Drop target

**Drop candidate**:
The single drop position currently offered to the user. It remains stable through small pointer movements and changes only when another position becomes clearly closer.
