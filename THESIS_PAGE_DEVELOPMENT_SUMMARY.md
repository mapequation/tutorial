# Thesis-oriented summary of the Map Equation demo page development

This document summarizes the development of the interactive Map Equation demo
page in a form that is useful for a thesis discussion. It is written as a
conceptual and methodological summary rather than a commit-by-commit changelog.
The focus is on what the page now demonstrates, why each version was introduced,
and how the implementation supports the pedagogical goal: explaining how
compression, random walks, codebooks, Infomap, regularization, and hierarchical
codebooks are connected.

## Overall purpose of the page

The page was developed as an interactive explanation of the Map Equation and
Infomap. The central idea is that community detection can be understood through
compression: if a random walk on a network can be described with fewer bits
using a modular codebook structure, then the modular structure captures
important regularities in the flow.

The page is organized as a sequence of increasingly advanced examples:

- A general compression motivation introduces why regularity matters.
- A Huffman coding and random-walker example explains codebooks, codewords,
  one-level coding, two-level coding, exit codes, enter codes, and codelength.
- A regularized Infomap example shows how Infomap behaves when links are
  removed from a complete network, and how regularization can stabilize the
  detected modules under incomplete data.
- A hierarchical codebook section extends the two-level Map Equation to
  multilevel descriptions, showing why multilevel codebooks are the natural
  general form and why a two-level solution is a restriction.
- A recursive triangle example demonstrates nested modular structure at a
  larger number of levels and connects this visual structure to multilevel
  codelengths and Pajek export.

The final result is not only a visualization, but a guided argument: the same
compression principle can explain simple node coding, two-level modular coding,
regularized community detection, and multilevel hierarchical coding.

## Development version 1: from compression intuition to random walks

The early page established the conceptual bridge between ordinary compression
and network regularities. The visual narrative starts from the idea that data
with repeated structure can be compressed more efficiently than unstructured
data. This motivates the central thesis point: if a network has regular flow
patterns, then those patterns can be detected by finding a short description of
a random walker moving on the network.

The first interactive network used a random walker moving on a modular network.
This gave the page a dynamic object that readers could follow. Instead of
introducing the Map Equation only as a static formula, the page makes the
random walk visible. This is important for the thesis because the Map Equation
is a flow-based method: the relevant object is not only the network topology,
but the probability flow induced by movement on the network.

Technically, this introduced a shared `Network` model with a `RandomWalker`.
The walker stores its current node, previous node, trace, visit counts,
teleportation state, and cumulative emitted bits. This made later sections
possible because the same walker could be reused for network animation,
running code traces, empirical codelength estimates, and codebook highlighting.

## Development version 2: Huffman coding as the entry point to codebooks

The Huffman coding section became the main pedagogical entry point for the Map
Equation. The goal of this version was to make codebooks concrete before asking
the reader to understand Infomap or multilevel modules.

The section explains that Huffman coding assigns short binary codes to common
symbols and longer codes to rare symbols. In the network setting, the symbols
are events produced by the random walker. The page compares two coding
strategies:

- A one-level partition, where all nodes share a single global codebook.
- A two-level partition, where an index codebook identifies modules and local
  module codebooks identify nodes inside modules.

The one-level and two-level network views were placed side by side so that the
reader can compare the same random walk under two different coding schemes. The
two-level view includes enter and exit codes: when the walker crosses a module
boundary, it must first print an exit code for the old module, then an enter
code for the new module, and then the node code inside the new module. This
directly visualizes the tradeoff in the Map Equation: modules are useful when
the walker stays inside them long enough that short local node codes compensate
for the occasional cost of entering and exiting modules.

Several iterations refined the Huffman section:

- The explanatory text was expanded to tell the reader what is needed to
  understand the network before interacting with it.
- A tooltip was added to the word "codebook" so the definition is available
  without overloading the main text.
- The reader is explicitly invited to change the two-level partition and
  observe how the codelength changes.
- The control row was made compact and stable. Buttons were given fixed widths
  based on their longest label so the layout does not shift when labels change.
- A help toggle was added. When help is enabled, hovering over controls explains
  what each button does.
- A teleportation toggle was added so the reader can compare a walker that only
  follows links with a walker that can occasionally jump.
- The speed slider was moved into the same control row as the buttons and
  resized so it fits without creating unnecessary vertical space.

These changes matter for a thesis because the section is no longer only a
visualization. It is an explanatory apparatus: definitions, controls, equations,
and observations are coordinated so the reader can experiment while retaining
the theoretical meaning of the experiment.

## Development version 3: codelength as both formula and empirical estimate

The codelength explanation was developed in several stages. Initially the page
showed codelength values as labels attached to the one-level and two-level
partitions. This made the result visible but did not yet explain how the values
were obtained.

The page was then extended to show the one-level codelength, two-level index
codelength, module codelength, total codelength, and the relative change between
the one-level and two-level descriptions. This introduced the idea that the
two-level partition should be judged relative to the one-level baseline: the
important question is not only "what is the codelength?", but "how much shorter
or longer is this description than using a single codebook?"

The codelength section was then rewritten to separate three ideas:

- The Map Equation can calculate the expected codelength directly from flow
  rates and the chosen partition.
- A simulated random walker is not required to calculate codelength or find
  communities.
- A simulated random walker is useful pedagogically because the emitted
  codewords provide an empirical estimate that approaches the theoretical value
  over many steps.

The displayed equations now include:

- The one-level entropy expression for a single global node distribution.
- The two-level Map Equation expression with an index codebook term and a sum
  over module codebook terms.
- Walker-based estimates written with a hat notation, where cumulative emitted
  bits are divided by the number of visits.
- A comparison between predicted and estimated codelength ratios.

The explanation of why predicted and estimated ratios differ was also refined.
The page now notes that finite walks need many steps to approach the expected
value, that teleportation can add extra enter and exit events, and that without
teleportation the walker can remain inside modules for long periods. This
prevents the reader from incorrectly treating the simulated walker as the
method itself. In thesis terms, the simulation is an intuition-building device,
whereas the Map Equation is the analytic objective.

Important UI refinements were made at this stage:

- The running code printer was given a minimum height so the page does not jump
  when the trace changes from one to two rows.
- The code printer output was moved directly under its title.
- Help tooltips were made faster on hover and instant on click.
- Question marks were repositioned next to the exact symbols they explain, such
  as entropy `H(.)`, module index distributions, and uniform priors.
- Scrollable boxes around equations were removed so formulas read as ordinary
  explanatory text rather than separate widgets.

## Development version 4: visual style, stability, and interaction polish

A large part of the work was devoted to making the page stable and readable
while values, status messages, and animations change. This is important because
layout movement distracts from the conceptual relationships the page is meant
to teach.

Several sources of layout shift were removed:

- The isolated-nodes notice in the regularization section was locked in place
  so it does not jump when pass, half-pass, fail, API-running, or collapse
  messages change length.
- Space was reserved for the "strong regularization collapses modules" warning
  so later content does not move when the warning appears or disappears.
- The running code printer was given stable height.
- Control buttons were given stable widths.
- Codelength labels were aligned and moved so the one-level and two-level
  values are visually comparable.

The visual design was also standardized. A custom color palette was introduced
and then narrowed to a deliberately ordered set of distinct colors for nodes,
links, modules, and codebook blocks. The first nine module colors were fixed in
this order:

```text
#EFAB6A, #B2CE75, #75A6D7, #E78C6E, #8E8ACE,
#79D2DF, #AE8635, #CEAA9E, #79D7BE
```

This made the repeated use of colors across network nodes, module regions,
codebooks, traces, and hierarchical examples more coherent. The color choice
also supports the thesis figures: modules can be visually tracked across
different representations without relying only on labels.

The random-walker trace and codebook pulse effects were refined. Codebook
blocks now darken when used, then fade back over several walker steps. Movement
itself does not fade; only color intensity changes. This distinction matters
because the movement shows the path, while the color pulse shows recent
codebook activity.

## Development version 5: Regularized Infomap under incomplete data

The regularization section was developed to demonstrate a more applied problem:
how Infomap behaves when the observed network is incomplete. The current
section uses a complete network as a reference, removes a percentage of links,
and compares standard Infomap with regularized Infomap on the incomplete
network.

The explanatory text was revised so the average degree is described in simple
terms as approximately 14.5 links per node. This was corrected because the
dataset counts undirected links twice: if there is a link from node 2 to node
78, the file also contains the reverse link from node 78 to node 2. Therefore
the raw count must not be interpreted as twice the actual number of undirected
links.

The section originally used a "truth similarity" measure, but this was replaced
with Adjusted Mutual Information (AMI), which is a standard clustering
comparison measure. The tooltip explains that AMI compares the current
partition with the reference partition while correcting for agreement expected
by chance. This is more appropriate for a thesis because it connects the demo
to a recognized evaluation metric.

The regularization example went through several important interface versions:

- It first showed a regularized network result in isolation.
- It was then redesigned to show standard Infomap and regularized Infomap at
  the same time.
- Standard Infomap was placed on the left and regularized Infomap on the right.
- The link-removal slider was made to affect both networks.
- The regularization-strength slider was placed near the link-removal control.
- The evaluation summary was moved between the two networks and simplified to
  show standard AMI and regularized AMI.
- Node labels were removed to reduce clutter.
- Network nodes were made smaller and then stabilized.
- The networks were given fixed node positions based on the 0% complete-network
  layout, so changing link removal or regularization strength changes links,
  colors, AMI, module labels, and pass/fail text without moving the nodes.

The Infomap integration was also improved technically. The page uses
`@mapequation/infomap` version 2.9.2 and runs with `-N 5` trials. To avoid
calling the API on every slider movement, results are precomputed and cached:

- Standard Infomap is computed once per link-removal level.
- Regularized Infomap is computed for all link-removal levels at the currently
  selected regularization strength.
- When the regularization strength changes, the regularized cache is rebuilt
  for that strength rather than storing all previous strengths indefinitely.
- Link removal is limited to 80 percent.
- Link removal is deterministic because a seeded pseudo-random generator is
  used. Therefore the same link-removal percentage removes the same links each
  time, which makes comparisons reproducible.

The section also gained a "show prior links" button. This button reveals the
prior links used by the regularized method as a light grey, low-opacity
background layer under the observed links. This helps explain that
regularization adds a weak structural prior rather than simply changing the
visible sparse network. The button style was adjusted to match the Huffman
controls and placed next to the link-removal slider.

## Development version 6: hierarchical codebooks and multilevel Map Equation

The hierarchical section evolved from a placeholder into a full demonstration
of multilevel codebooks. Its purpose is to show that the multilevel Map
Equation is the natural generalization, while a two-level solution is a
restricted special case.

The text in this section was rewritten using information from the Rosvall and
Bergstrom paper and a broader Map Equation review. The current wording
emphasizes that multilevel codebooks are not merely "three levels"; rather, the
walker can name a path through as many nested modules as the network supports.
This distinction is important for the thesis because it avoids presenting
hierarchical codebooks as a fixed-depth construction. The number of useful
levels is part of the compression problem.

The section now compares two views of the same toy topology:

- A multilevel network view, where nine small triangle modules are nested
  inside three larger top-level modules labeled with roman numerals.
- A two-level network view, where the same nine small modules are flattened
  into one layer labeled a-i.

This makes the restriction of a two-level partition visible. The topology does
not change; only the description changes. In the multilevel view the walker can
use a top index, then a lower index, then a module codebook. In the two-level
view the top index is unavailable, so all small modules must be selected from a
single flat index.

The codebook comparison was rebuilt from scratch. It now uses blocks styled
like the Huffman codebook blocks:

- Three top-level enter blocks for the multilevel top index.
- Nine lower-level enter blocks plus three exit blocks for the next index
  level.
- Twenty-seven node blocks plus nine exit blocks for the finest module
  codebooks.
- A corresponding two-level codebook where all nine fine modules are selected
  from one flat index.

Blocks are stacked compactly, and connector lines show how index codebooks lead
to lower codebooks. The hover interaction works in both directions: hovering a
network node or module highlights the corresponding codebook block, and
hovering a codebook block highlights the corresponding network object. Exit
blocks are treated specially: they do not light up as ordinary destination
blocks, but hovering an exit block highlights the module it exits from.

A random walker was then added to the multilevel and two-level network views.
The walker reuses the same model-backed random-walker logic as the Huffman
section. It has compact controls for reset, step, start/stop, and speed. The
same walker trace is rendered in both network views so the reader can compare
how the same movement is encoded by multilevel and two-level codebooks. The
codebook visualization darkens the blocks emitted on each walker transition.
Under each codebook column, a counter shows how many steps have passed since
that column last emitted a block. This makes it visible that index codebooks
are only used when the walker crosses the relevant module boundary, whereas
module codebooks are used on every node visit and on exits.

The codelength display for the first two hierarchical figures was also changed
from simple totals to explicit Map Equation calculations based on the
page-three calculation in the Rosvall and Bergstrom paper. The display now
shows:

- The two-level Map Equation term for the index codebook plus the sum of module
  codebook terms.
- The multilevel analogue with a top index term, lower index terms, and node
  module terms.
- The numeric sum of the displayed terms.

This is thesis-relevant because it connects the visual codebook stacks to the
actual objective function. The reader sees that each codelength is not an
arbitrary label but a sum of codebook contributions: use rate times entropy.

## Development version 7: recursive triangle as a larger multilevel example

The recursive triangle section was added to show a deeper nested structure than
the first hierarchical toy network. It is a Sierpinski-style triangular network
where triangles contain smaller triangles, which contain still smaller
triangles, down to bottom-level node triangles.

This section went through several visual iterations:

- The initial recursive network was too large and was resized so the triangle
  fits comfortably in a smaller display area.
- Zoom behavior was added so the reader can click into one triangle and make
  that triangle fill the view.
- Zoom-out behavior was made slow and smooth, matching the zoom-in transition.
- Sibling triangles were made to appear as if they remain outside the clipped
  viewport rather than being removed from the data.
- Clicking outside the current triangle acts like pressing back.
- The full triangle was scaled so its clipped edges sit just outside the bottom
  nodes, maximizing use of the available view.

The indexing system was designed to mirror the earlier multilevel example while
scaling to more levels. The levels use roman numerals, letters, numbers,
uppercase letters, and lowercase symbols, so a nested location can be described
as a path through multiple codebooks. Colors were first applied as module
regions, then refined so the color fills stay inside the bounds of visible
nodes and links rather than extending beyond the actual network structure.

The recursive triangle also supports Pajek export. Link weights were adjusted
so links between the smallest modules have weight 0.85, and links between
larger modules are multiplied by 0.85 at each higher level. This means that
connections between larger-scale modules are weaker than connections inside
lower-level structures, reinforcing the nested modular pattern. The exported
Pajek network reflects these weights and omits unnecessary x, y, z coordinate
fields.

The codelength display for the recursive triangle separates multilevel and
two-level codelengths. The multilevel side lists codelength contributions for
each level and for the bottom node modules. The two-level side currently
displays the specified index and node-module values to three decimals. The
layout was repeatedly tightened so values align in columns and fit on one row
without introducing excessive whitespace.

## Implementation architecture

The final page is implemented primarily through the following components:

- `src/components/Main.tsx`: the main page structure and the Huffman coding
  section.
- `src/components/WalkerControls.tsx`: stable controls for the Huffman random
  walker, including help hints, teleportation, link weights, visits, and speed.
- `src/components/Trace/CodelengthChart.tsx`: the one-level and two-level
  codelength explanation, formulas, estimates, and predicted/estimated ratio.
- `src/components/CodeBooks/CodeBooks.tsx`: the Huffman-style index and module
  codebook visualization with pulse highlighting.
- `src/components/RegularizedInfomap.tsx`: the standard vs regularized Infomap
  comparison, AMI evaluation, precomputation, prior-link overlay, and charts.
- `src/components/HierarchicalCodebooks.tsx`: the multilevel/two-level
  hierarchical networks, codebook comparison, codelength decomposition,
  recursive triangle, zoom interaction, random walker, and Pajek export.
- `src/networks/hierarchical_paper_toy.ts`: the hierarchical toy topology,
  module grouping, and weighted links used for the multilevel comparison.
- `src/networks/regularized_infomap_network.ts`: deterministic parsing,
  positioning, and seeded link removal for the regularization example.

The implementation uses model objects for networks, nodes, links, trees,
Huffman coding, Map Equation calculation, PageRank-style visit rates, and the
random walker. This model layer is important because it allows the visual
components to share the same underlying state: a node visit can update the
network view, trace, codebook pulses, visit rates, and empirical codelength
estimates simultaneously.

## Thesis contribution of the final page

The final page contributes to the thesis in three ways.

First, it gives a visual explanation of the compression principle behind the
Map Equation. The reader can see that a good partition is one that balances the
cost of switching modules against the benefit of shorter local node codes.

Second, it distinguishes theoretical calculation from simulation. The Map
Equation directly computes expected codelengths from flow rates and partitions;
the random walker is included to build intuition and to generate empirical
estimates. This prevents the common misunderstanding that the random walker is
itself the optimization method.

Third, it extends the explanation from simple codebooks to realistic and
advanced settings: incomplete data, regularization, and hierarchical
communities. The regularization section shows why a prior can stabilize module
detection when data are missing. The hierarchical section shows why multilevel
codebooks are not an optional decorative extension, but the natural general
form of the Map Equation when networks contain nested structure.

## Possible thesis wording

The following paragraph can be adapted into the thesis:

> The interactive demo was developed to make the Map Equation interpretable as
> a compression problem rather than only as a community-detection algorithm. A
> simulated random walker generates codewords under different codebook
> structures, allowing the reader to compare one-level, two-level, and
> multilevel descriptions of the same network. The Huffman coding section
> introduces local and global codebooks, enter and exit codes, and codelengths.
> The regularized Infomap section extends the demonstration to incomplete
> networks by comparing standard and regularized Infomap under deterministic
> link removal, using AMI against a complete-network reference partition. The
> hierarchical section then shows that two-level coding is a restriction of the
> natural multilevel Map Equation: when modules contain nested submodules, a
> walker can be described more efficiently by a path through several codebooks.
> Together, the sections demonstrate how the same compression principle
> explains modular coding, regularization, and hierarchical community
> structure.

## Summary of the most important implemented improvements

- The demo evolved from static explanation into a coordinated interactive page
  where random walks, codewords, codebooks, codelengths, module assignments,
  Infomap output, and evaluation metrics update together.
- The Huffman section now clearly introduces one-level and two-level coding,
  codebooks, enter codes, exit codes, codelengths, teleportation, and empirical
  walker estimates.
- The codelength explanation now uses equations and symbol explanations rather
  than only displaying final values.
- The regularized Infomap section now compares standard and regularized
  Infomap side by side, uses AMI, caches API runs, fixes node positions,
  visualizes prior links, and avoids layout jumps.
- The hierarchical section now explains that multilevel is the natural Map
  Equation formulation, shows multilevel and two-level descriptions of the same
  topology, builds a compact codebook comparison, and connects it to explicit
  codelength calculations.
- The recursive triangle demonstrates a deeper nested modular network with
  zoom interaction, indexed hierarchy, codelength summaries, and Pajek export.
- Repeated interface refinements made the page stable enough for thesis use:
  buttons do not resize, status text does not move surrounding content,
  tooltips appear close to the relevant symbols, and visual encodings are
  consistent across sections.

