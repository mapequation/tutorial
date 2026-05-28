# Thesis-oriented summary of the Map Equation demo page development

This document summarizes the development of the interactive Map Equation demo
page in a form intended to support a master thesis. It is not a commit-by-commit
technical changelog. Instead, it explains the conceptual development of the
page: what was built, why different versions were introduced, which
pedagogical problems each version solved, and how the final demo supports a
thesis about explaining the Map Equation through interactive visualization.

The central theme of the demo is that community detection with the Map Equation
can be understood as a compression problem. If a random walker moves through a
network with regular flow patterns, those regularities can be exploited by
using codebooks that describe common events with shorter codewords. The page
therefore does not introduce Infomap only as a black-box clustering algorithm.
It builds up the idea from coding, random walks, codelength, and codebooks, and
then extends the same idea to incomplete networks and hierarchical community
structure.

## Purpose and thesis role

The demo was developed to make the Map Equation interpretable as an interactive
article. Its purpose is to help a reader move from intuition to formalism
without losing the connection between the visual behavior of a random walker
and the equations that Infomap optimizes.

The thesis-relevant purpose can be summarized in four points.

First, the page makes compression visible. The reader sees that a random walk
can be described with binary symbols, that frequently used symbols should
receive shorter codewords, and that a good module partition is one that reduces
the expected number of bits per step.

Second, the page separates intuition from method. The random walker is visible
because it is a useful way to understand flow and emitted codewords. However,
the Map Equation does not need to wait for a simulated walker to calculate
codelength. It calculates expected codelength directly from flow rates and a
partition.

Third, the page links the two-level Map Equation to the more general multilevel
Map Equation. The two-level case is presented as a useful constrained form, not
as the natural endpoint. This is important because hierarchical codebooks are
not just a visual embellishment; they are the natural way to describe nested
flow regularities when extra levels reduce codelength.

Fourth, the page connects the core theory to a practical problem: incomplete
network data. The regularized Infomap section shows that missing links can make
standard Infomap split a network too aggressively, and that a weak prior can
stabilize the result.

## Final learning path of the demo

The final page is organized as a guided article rather than as separate
independent widgets. The current section order is:

- `Learn the Map Equation`: the opening interaction begins with a two-level
  network in a poor partition state, so the reader immediately sees that moving
  nodes between modules changes codelength.
- `Huffman coding`: the page introduces codebooks, codewords, running code
  printers, enter and exit codes, one-level and two-level descriptions, and a
  random walker.
- `From Huffman codes to Shannon entropies`: the page connects printed
  codewords to expected codelength, first for the full weighted network and then
  through a small two-triangle example where every count can be seen directly.
- `Beyond two levels`: the page bridges from the one-level and two-level Map
  Equation to the multilevel map equation, explaining recursion and the
  two-level constraint.
- `Hierarchical codebooks`: the page compares two-level and multilevel
  descriptions of the same weighted hierarchical toy network, including
  codebook blocks, walker highlighting, and explicit use-rate times entropy
  codelength rows.
- `Regularized Infomap`: the page introduces missing links, compares standard
  and regularized Infomap on incomplete observations, shows AMI evaluation, and
  lets the reader inspect or export the current network.
- `Where do we go from here`: the page suggests copying the network in Pajek
  format and trying it in Infomap Online.

This order was chosen after several iterations. Earlier versions began with
more static motivation or formula-focused explanations. The final order starts
with direct interaction because the user first experiences the central claim:
the same network can become easier or harder to describe depending on the map.
Only after that interaction does the page explain why this is a compression
problem.

## Version 1: Compression intuition and random walks

The earliest conceptual version of the demo used compression as the entry point.
The goal was to make the reader understand that regularity matters before
introducing modules, Infomap, or hierarchical codebooks.

The central idea was that data with repeated structure can be described more
efficiently than data without structure. Translated to networks, this means
that if a random walker tends to remain inside certain regions, then those
regions can be assigned local codebooks. The local codebooks make common node
visits cheaper to describe. The cost is that moving between regions requires
additional codewords. A module partition is useful only when the savings inside
modules outweigh the cost of switching between them.

This version established the random walker as the main visual object. The
walker provides a concrete way to talk about flow: it visits nodes, crosses
module boundaries, emits codewords, and gradually generates an empirical
description length. This is useful for teaching because the reader can see
events happening in time rather than only reading a formula.

The important thesis point from this version is that the Map Equation is
flow-based. The relevant object is not only the topology of the network, but the
probability distribution over movements on the network. The walker visualization
helps prevent the reader from interpreting modules as purely geometric clusters.
Instead, modules are regions that make the flow description shorter.

## Version 2: Interactive article restructure

The page was later restructured as an interactive article inspired by the idea
that explanation should be integrated with manipulation. Instead of placing a
long theoretical introduction before any interaction, the page now begins with
an editable two-level partition.

This was a major pedagogical change. The reader no longer starts by passively
reading definitions. They first see a network, a partition, and a codelength.
They can move nodes between communities and observe the coding cost change.
This establishes the central problem before the formal vocabulary is introduced.

The compressed motivation section was moved after the initial interaction. This
means the page first creates a question in the reader's mind: why does changing
the partition change the number of bits? The later text then explains the
answer in terms of maps, flow, codebooks, and compression.

The article structure also changed the visual language of the page. White
boxes around large sections were removed so the page reads more like a
continuous article. Section titles were simplified, red eyebrow labels were
used sparingly, and network visualizations became the main anchors of the
layout. This helped the page feel less like a collection of demos and more like
a single learning path.

For thesis purposes, this version is important because it reflects a design
choice: interaction is not added after the explanation, but is used to motivate
the explanation. The page teaches by letting the reader manipulate the object
that the equation will later describe.

## Version 3: Huffman coding and node selection

The Huffman coding section became the main entry point into codebooks. The
Map Equation depends on information-theoretic coding, but it is difficult to
understand index codebooks, module codebooks, enter codes, and exit codes
without first seeing what a codebook does. Huffman coding provides a concrete
example: common symbols get short binary codes and rare symbols get longer
binary codes.

The section compares one-level and two-level descriptions of the same random
walk. In the one-level description, all nodes share a single global codebook.
In the two-level description, the walker uses an index codebook to enter a
module and then a module codebook to describe nodes inside that module. When
the walker leaves a module, an exit code is printed. This directly visualizes
the tradeoff in the two-level Map Equation.

The node-selection interaction lets the reader draw a lasso around nodes and
assign them to a selected community. This is important because it turns the
partition into something the reader can edit directly. The reader can try a bad
partition, an improved partition, or a one-module special case, and then see how
the codelength, codebooks, and code printer respond.

Several refinements made this section usable as a teaching tool:

- The starting interaction opens in a poor solution state so there is something
  for the reader to improve.
- The "optimal/bad solution" button is labelled as the action it will perform,
  avoiding ambiguity.
- The community selector was moved close to the network, and its help tooltip
  explains how to select a community and draw a lasso.
- The copy-Pajek button for the Huffman two-level network was placed inside the
  network region without disrupting the interaction.
- Node identifiers were removed from the one-level and two-level network views
  to reduce visual noise.
- The one-module special case was handled explicitly: if all nodes are in one
  module, no enter/exit codebook is shown, and hidden exit symbols do not affect
  the node Huffman codes.

This version teaches that the module assignment is not decorative. It changes
which codebooks are used and therefore changes the expected number of bits. In
a thesis, this supports the argument that interaction can make an abstract
optimization objective visible.

## Version 4: From printed codes to Shannon entropies

The running code printer was introduced to show the actual stream of codewords
emitted by the walker. This made the connection between network movement and
binary description concrete. Instead of saying that a module crossing has an
exit and enter cost, the page shows those codewords appearing in the trace.

The code printer compares the one-level and two-level descriptions. The maximum
number of visible codes was limited so the trace fits on screen, and the output
was made stable so the page does not jump when traces change length. The code
printer was also moved directly under its title, making it easier to associate
the title with the printed codewords.

The section includes controls for stepping the walker, starting and stopping
animation, changing speed, toggling teleportation, showing visit rates, and
resetting. The controls were iterated many times to avoid layout shifts. Button
widths are stable, labels are centered, and the speed slider sits in a compact
layout.

Teleportation was added because it reveals an important modeling distinction.
With teleportation on, the walker can jump between modules, which can add extra
enter and exit codewords in the printed trace. With teleportation off, the
walker can remain inside modules for long periods. The page therefore explains
that the empirical trace is only an estimate of the expected codelength, and
that finite simulations can differ from the theoretical prediction.

The thesis-relevant lesson is that printed codewords make entropy and
codelength less abstract. The reader can see that codelength is not an
arbitrary score; it is the expected cost of describing events generated by the
walker.

## Version 5: Detailed codelength walkthrough

The codelength chapter was rewritten to connect the Huffman code printer to the
formal Map Equation calculations. The section title is now `From Huffman codes
to Shannon entropies`, which reflects the transition from concrete binary
codewords to expected codelengths calculated from probability distributions.

The first part of the section shows the codelength equations for the full
weighted Huffman network. It presents:

- The one-level codelength as the entropy of the full node-visit distribution.
- The two-level codelength as an index-codebook term plus module-codebook
  terms.
- The predicted one-level and two-level codelengths.
- Walker-based estimates written with hat notation.
- The ratio between one-level and two-level descriptions.

The text explicitly explains that the random walker is not required to compute
the Map Equation. The walker estimates what the equation calculates from flow
rates. This prevents a common misunderstanding: the random walk is a conceptual
and visual aid, not the optimization procedure itself.

Because the full Huffman network is weighted, the exact arithmetic is not easy
to see by counting links. To solve that problem, a small unweighted
two-triangle network was added. It contains two triangles connected by one
bridge. Since the network is unweighted and undirected, every link direction
has equal flow. Seven undirected links become fourteen equally likely link
directions. This makes the fractions in the equations countable by inspection.

The two-triangle walkthrough shows both one-level and two-level calculations.
For one-level coding, node probabilities are based on degree divided by the
fourteen link directions. For two-level coding, the bridge contributes exits
and entries, module codebook use rates are normalized, and the local
distributions include both node symbols and exit symbols.

The section also includes a use-area diagram inspired by the paper
calculation: each codebook contribution is a rectangle where width is the
codebook use rate, height is entropy, and area is codelength contribution. The
area blocks are split into sub-intervals for node labels and exit symbols. When
the reader hovers a fraction, a node, an exit term, or a codebook area, the
corresponding part of the network and calculation is highlighted.

Several iterations refined this walkthrough:

- Hovering one-level terms no longer highlights two-level terms or area blocks.
- Hovering two-level terms no longer highlights one-level terms except where
  the shared entropy formula is intentionally referenced.
- The hover behavior is hover-only, not sticky on click.
- Bridge highlights for opposite crossing directions have a small gap so the
  reader can see that the two directions are separate accounting events.
- Explanations were moved into hover tooltips where possible, keeping the page
  compact while preserving detail.
- Fractions were rendered vertically rather than as plain text so the formulas
  are readable.
- The heading `How codelength is calculated` was enlarged to make the detailed
  walkthrough feel like a major subsection.

This version is central for thesis use because it turns the Map Equation from a
symbolic expression into a countable example. It shows how flow rates, entropy,
normalization, and codelength contributions fit together.

## Version 6: Beyond two levels and the multilevel map equation

After the codelength chapter, the page transitions to the multilevel Map
Equation. This transition was added because the reader has just learned the
one-level and two-level equations, and the next question is why the description
should stop at two levels.

The section is titled `Beyond two levels`, with the red label `Multilevel
mapequation`. It explains that the two-level Map Equation is useful but
constrained: one index codebook chooses a module, and then a local module
codebook must describe the node or exit. In a nested network, however, a module
may contain a smaller map. The multilevel Map Equation captures this recursive
structure.

The multilevel equations are shown directly in this transition section. The
formula explains:

- A top index term chooses among broad modules.
- A recursive term computes the codelength of the map inside a chosen module.
- A lower index term can choose among submodules inside a module.
- The recursion continues until a final local codebook describes node visits
  and exits.
- The two-level equation is shown as the constrained case where no recursive
  submap is allowed.

Tooltips explain each equation term. This keeps the visual presentation compact
while still allowing a reader to inspect the role of each term. The text also
states that Infomap does not need the number of levels fixed in advance. Extra
levels are kept only if the shorter local codebooks compensate for the extra
index-codebook cost.

The thesis importance of this section is that it reframes multilevel Infomap as
the natural general case. Two-level coding is not wrong, but it is a limitation.
This distinction matters when explaining hierarchical community structure:
hierarchies are not imposed for aesthetics; they are retained only when they
improve compression.

## Version 7: Hierarchical codebooks

The `Hierarchical codebooks` section compares two descriptions of the same
weighted hierarchical toy network. The network is built from nine triangle
modules. In the multilevel description, these nine small modules are nested
inside three broad top-level modules. In the two-level description, the same
nine small modules are flattened into one layer.

This comparison is deliberately visual. The two-level network is placed on the
left and the multilevel network on the right. Both use the same topology and
random-walker movement. The difference is the map used to describe the
movement. The two-level description uses a single flat index over the nine
small modules. The multilevel description first chooses a broad roman-numeral
module, then a lower-level submodule, then a local node codebook.

The codebook visualization was rebuilt to match the style of the earlier
Huffman codebook blocks. The multilevel side contains:

- Top-level index blocks for broad modules.
- Lower index blocks for submodules and exits.
- Final module codebooks for node visits and exits.

The two-level side contains:

- One flat index over the nine fine modules.
- Local module codebooks for node visits and exits.

Connector lines show how one codebook leads to the next. Hovering a node or
module in a network highlights the corresponding codebook block, and hovering a
codebook block highlights the corresponding network object. The hover behavior
was refined so exit blocks do not incorrectly light up like destination blocks.
When an exit block is hovered, the related module is highlighted instead.

A random walker was added to the hierarchical comparison. The walker controls
are placed between the two network views so the two descriptions can be
compared symmetrically. The walker emits codebook activations in both
codebook visualizations. Blocks darken when used and then fade back over
several steps, consistent with the Huffman codebook section.

Counters under codebook columns show how long it has been since a column was
used and how many total activations occurred. Exit uses are included in the
activation totals. This matters because an exit symbol is a real codebook use:
leaving a module has to be encoded just as node visits have to be encoded.

The hierarchical codelength display was also refined. It now writes the
calculation in terms of use rate times entropy. For both the two-level and
multilevel descriptions, the display lists rows of the form:

```text
use rate x entropy = contribution
```

This connects the codebook visualization to the objective function. The reader
can see that multilevel codebooks may be used more often overall, but the
frequent local codebooks can become cheaper because they are smaller and more
specific. A multilevel description wins only when those savings exceed the cost
of extra index codebooks.

The hierarchical toy network itself went through several versions. The current
network keeps the earlier link connections while assigning weight `0.8` only to
links between top modules; other links have weight `1`. This makes the
top-level modular structure visible without changing the basic comparison.

For thesis purposes, this section demonstrates that hierarchical codebooks are
not only an abstract recursive formula. They correspond to visible coding
events, codebook activations, and codelength contributions.

## Version 8: Regularized Infomap and incomplete data

The regularization section introduces a practical problem: real observed
networks may be incomplete. The page begins with the title `What if we have
missing links` and shows two small networks, a true network and an observed
network. The large background network used in an earlier version was removed.
Instead, the small networks now have stubs showing that they are fragments of a
larger network. This keeps the visual focused while still implying that the
observed fragment belongs to a broader system.

The main `Regularized Infomap` section compares standard Infomap and
regularized Infomap side by side. Standard Infomap runs on the observed sparse
network. Regularized Infomap uses the same observed network but adds a weak
uniform prior. The text explains this simply: the prior adds a small amount of
expected background flow between nodes, so missing links are not treated as
absolute evidence that two parts of the network are unrelated.

The section uses a complete network as the reference. Links are removed
deterministically to simulate incomplete observations. Determinism is important:
the same link-removal percentage removes the same links each time, so the
reader can compare standard and regularized results without random variation in
the input.

The evaluation metric was changed from a custom truth-similarity idea to
Adjusted Mutual Information (AMI). AMI is a standard way to compare two
partitions while correcting for agreement expected by chance. The page uses AMI
to compare the recovered partition with the complete-network reference
partition. This makes the evaluation more appropriate for thesis discussion.

The regularization section went through several important implementation
versions:

- It originally showed one regularized result in isolation.
- It was redesigned to show standard Infomap and regularized Infomap together.
- The link-removal slider affects both networks.
- The regularization-strength slider affects only the regularized runs.
- AMI and module-count charts show how performance changes across link removal.
- The evaluation summary was moved between the networks.
- Node positions were fixed to the 0% complete-network layout, so changing link
  removal or regularization strength changes colors, links, modules, and
  scores without moving nodes around.
- Infomap API calls were cached and precomputed. Standard Infomap is computed
  once per link-removal level. Regularized Infomap is computed for all
  link-removal levels at the current regularization strength, and rebuilt when
  the strength changes.
- Link removal was limited to 80 percent.
- Prior links can be shown as a light grey low-opacity layer under the observed
  links.

The section also includes a `Where do we go from here` part with the title
`Try Infomap online`. The copy controls were moved into this section. The user
can copy the current observed network in Pajek format, as well as the standard
and regularized tree outputs. The intended future direction is a direct link
that opens the network in Infomap Online. For now, copying the Pajek network
supports the same thesis purpose: the demo points beyond itself toward the
actual Infomap tool.

The thesis relevance of this section is that it extends the Map Equation from a
clean pedagogical network to an applied data-quality problem. It shows why
incomplete observations can produce spurious fragmentation and how
regularization can stabilize flow-based community detection.

## Version 9: Visual stability and interaction polish

A large part of the development was devoted to making the page stable. This
matters because layout movement distracts from learning. If labels, warnings,
or code traces cause the page to jump, the reader loses the connection between
interaction and concept.

Several layout-shift problems were addressed:

- The running code printer was given stable height and a fixed number of
  visible codes.
- Buttons were given widths based on their longest label so toggling does not
  change the control row.
- Status text in the regularization section reserves space so API-running,
  pass, half-pass, fail, isolated-node, and module-collapse messages do not
  move surrounding content.
- The two-level partition helper text was moved into a tooltip so it does not
  push the network around.
- Codelength labels were repositioned and aligned so one-level and two-level
  values are comparable.
- The one-level and two-level network visualizations were scaled and aligned so
  they feel like comparable views rather than unrelated figures.

The page's visual style was also standardized. A shared color palette was used
for nodes, links, modules, and codebook blocks. The first nine important colors
were fixed in a specific order:

```text
#EFAB6A, #B2CE75, #75A6D7, #E78C6E, #8E8ACE,
#79D2DF, #AE8635, #CEAA9E, #79D7BE
```

This palette supports continuity. A module color can be recognized across a
network, codebook block, trace highlight, and codelength display. Later
refinements removed unnecessary outlines, reduced visual clutter, and made
hover highlights more precise.

Help tooltips were also standardized. Question marks were placed close to the
symbols or words they explain. Tooltips appear quickly on hover and instantly
on press where that behavior remains appropriate. In the codelength walkthrough,
some explanations were moved directly into hoverable equation terms to keep
the visible text compact.

The thesis relevance of these changes is methodological. A demo used in a
thesis must not only be correct; it must be legible. Stable layout, consistent
colors, and local explanations make the page usable as an explanatory artifact.

## Retired and exploratory versions

Several earlier versions were valuable during development but are no longer
part of the current final page in the same form. They should be described as
exploratory design work, not as current functionality.

The largest retired exploration was the recursive or Sierpinski triangle
network. This section was built to demonstrate a deeper hierarchy than the
nine-triangle hierarchical toy network. It included a zoomable recursive
triangle, nested labels, Pajek export, and codelength summaries for multiple
levels. The design explored how a reader might navigate a many-level modular
network by zooming into successive triangles.

The recursive triangle went through many iterations:

- The SVG was resized and clipped so the triangle fit the available space.
- Zoom-in and zoom-out transitions were made slow and smooth.
- Sibling triangles were kept visually outside the viewport rather than being
  removed.
- Clicking outside the current triangle acted like going back.
- Labels and colors were designed to show nested module identities.
- Link weights were scaled across levels so higher-level module connections
  were weaker than lower-level connections.

Although this work was eventually removed from the current page order, it
informed the final hierarchical codebook section. It clarified that a deep
hierarchy can become visually complex, and that the thesis demo benefits from a
more compact comparison between two-level and multilevel descriptions of the
same manageable network.

Another exploratory direction involved showing larger background networks in
the incomplete-data introduction. That version tried to make the true and
observed fragments appear as zoomed-in parts of a much larger network. It was
later simplified to small networks with stubs. The final design communicates
the same idea with less visual noise.

These retired versions are useful for the thesis because they show iterative
design reasoning. The final page is not simply the first implementation; it is
the result of testing which visual metaphors explain the concepts clearly and
which ones add unnecessary complexity.

## Implementation architecture

The demo is implemented as a React and TypeScript page backed by a shared model
layer. The important architectural point is that visual components are not
isolated drawings. They share network, tree, walker, Huffman-coding, and
Map Equation state.

The main page structure is coordinated in `src/components/Main.tsx`. This file
defines the article order, the opening node-selection interaction, the Huffman
section, the codelength walkthrough, and the transition to multilevel coding.

The codelength explanation for the full Huffman network lives in
`src/components/Trace/CodelengthChart.tsx`. It reads the current network's
Map Equation values and walker estimates, so edits to the partition are
reflected in the displayed equations and ratios.

The regularization example is implemented in
`src/components/RegularizedInfomap.tsx`. It loads the complete network, creates
deterministic incomplete versions, runs standard and regularized Infomap,
caches runs across link-removal levels, fixes node positions, calculates AMI,
and renders the comparison views and charts.

The hierarchical comparison is implemented in
`src/components/HierarchicalCodebooks.tsx`. It constructs the two-level and
multilevel views of the hierarchical toy network, renders the codebook
comparison, runs the walker, computes codelength group contributions, and
supports Pajek export for the comparison network.

The model layer includes network parsing, nodes, links, hierarchical trees,
Huffman code generation, random-walker state, and Map Equation calculations.
This shared model is important because one walker step can update the network
view, trace, codebook pulse, visit counters, and empirical codelength estimate
together.

## Thesis contribution

The final demo contributes to a thesis in three main ways.

First, it explains the Map Equation as a compression principle. The reader sees
that codelength is the expected number of bits needed to describe movement on a
network. A good partition is one that reduces this expected description length.

Second, it provides a bridge from informal intuition to formal calculation. The
Huffman section shows printed codewords. The codelength section shows the
entropy calculations behind those codewords. The two-triangle example makes the
fractions countable. The multilevel section then shows how the same principle
recurses through nested modules.

Third, it connects theory to practice. The regularization section shows that
network observations can be incomplete and that missing links can distort
standard community detection. The use of AMI, cached Infomap runs, fixed node
positions, and prior-link visualization makes this problem experimentally
visible.

Together, the sections support a thesis argument that interactive visualization
can make an information-theoretic community-detection method easier to
understand. The page does not simplify the Map Equation by hiding its
structure. Instead, it stages the structure gradually: codewords, codebooks,
codelength, two-level partitions, multilevel recursion, and regularization.

## Possible thesis wording

The following paragraphs can be adapted directly into a thesis.

> The interactive demo was developed to explain the Map Equation as a
> compression problem for network flows. Rather than presenting Infomap only as
> a clustering algorithm, the page makes the coding process visible. A random
> walker moves through a network and emits codewords under one-level,
> two-level, and multilevel codebook structures. This allows the reader to
> connect node visits, module crossings, enter and exit codes, and codelengths
> to the formal Map Equation objective.

> The first part of the page introduces codebooks through Huffman coding. The
> user can directly edit a two-level partition and observe how the codelength
> changes. This interaction demonstrates the central tradeoff in the Map
> Equation: local codebooks make common within-module node visits cheaper, but
> moving between modules requires additional exit and enter codewords. A
> partition is therefore useful only if the savings inside modules outweigh the
> cost of switching modules.

> The codelength chapter connects the printed codewords to Shannon entropy. It
> distinguishes between the simulated random walker, which provides an
> intuition-building empirical estimate, and the Map Equation calculation,
> which computes expected codelength directly from flow rates and a partition.
> A small unweighted two-triangle network is used to make every probability,
> use rate, entropy, and codelength contribution countable by inspection.

> The hierarchical section extends the same logic to the multilevel Map
> Equation. Two-level coding is presented as a constrained case, while the
> multilevel formulation allows a module to contain its own smaller map. The
> comparison between two-level and multilevel descriptions of the same network
> shows that additional levels are retained only when they reduce total
> codelength. This makes hierarchical codebooks visible as a recursive
> compression strategy rather than as an externally imposed hierarchy.

> The regularization section connects the explanatory demo to incomplete
> network data. By removing links from a complete network, the page shows how
> standard Infomap can split the observed sparse network into spurious modules.
> Regularized Infomap adds a weak prior, reducing the effect of missing links as
> evidence for separation. The comparison uses Adjusted Mutual Information
> against the complete-network reference partition, making the effect of
> regularization measurable as well as visible.

## Summary of the most important improvements

- The page was restructured into an interactive article that begins with direct
  manipulation rather than a long theoretical introduction.
- The Huffman section now teaches codebooks, codewords, enter and exit symbols,
  one-level coding, two-level coding, teleportation, and codelength through a
  shared random-walker interaction.
- The codelength section now connects printed codewords to Shannon entropy and
  includes a detailed two-triangle calculation where every fraction is visible.
- The page explicitly states that the random walker is a pedagogical estimate,
  while the Map Equation computes expected codelength from flow rates.
- The `Beyond two levels` transition presents the multilevel map equation and
  explains that two-level coding is a constraint.
- The hierarchical section compares two-level and multilevel descriptions of
  the same weighted network, with codebook highlighting, walker pulses, and
  use-rate times entropy codelength rows.
- The regularization section compares standard and regularized Infomap under
  deterministic link removal, uses AMI, caches Infomap runs, fixes node
  positions, and visualizes prior links.
- The page now includes a practical handoff toward Infomap Online through
  Pajek copy controls.
- Historical exploratory versions, especially the recursive triangle, informed
  the final design but are clearly separated from the current page state.
- Repeated visual refinements made the demo stable enough for thesis use:
  controls do not resize, dynamic text does not move the page, hover
  explanations are local, colors are consistent, and unnecessary boxed layouts
  were removed.
