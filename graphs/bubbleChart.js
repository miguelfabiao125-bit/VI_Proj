
const bubbleCountsCache = new Map();

function createBubbleChart(container, data, actions) {
    const fields = [
        { label: "Card Name", field: "name" },
        { label: "Rarity",    field: "rarity" },
        { label: "Type",      field: "type" },
        { label: "SubType",   field: "subtype" }
    ];

    const maxBubbles = 15;
    const width = 560;
    const height = 400;

    const typeColors = {
        Metal: "#d6d3cf",
        Darkness: "#5f7b8a",
        Grass: "#3fae5a",
        Fairy: "#f2a7c3",
        Water: "#4fc3f7",
        Colorless: "#e8e8e8",
        Lightning: "#ffe94a",
        Fire: "#e8605a",
        Fighting: "#e8793a",
        Psychic: "#a05cb0",
        Dragon: "#a39d6e"
    };

    const otherColors = d3.scaleOrdinal(
        d3.schemeTableau10.concat(d3.schemeSet3)
    );

    const colorOf = name =>
        typeColors[name] || otherColors(name);

    const minLabelRadius = 22;
    const minBubbleRadius = 32;

    let smallestDisplayedCount = 1;

    function radiusOf(node) {
        const countBasedMinimum = minBubbleRadius
            + Math.log1p(
                node.data.value / smallestDisplayedCount
            ) * 6;

        return Math.max(node.r, countBasedMinimum);
    }

    function shorten(name, radius) {
        const max = Math.floor(radius / 3.5);

        return name.length > max
            ? name.slice(0, max) + "…"
            : name;
    }

    function nameLines(name, radius) {
        if (!name.includes("/")) {
            return [shorten(name, radius)];
        }

        const parts = name.split("/");

        return [
            shorten(parts[0].trim() + " /", radius),
            shorten(parts.slice(1).join("/").trim(), radius)
        ];
    }

    let current = fields[0];

    let lastState = {
        artists: [],
        years: [],
        sets: [],
        bubbles: []
    };

    // ALTERAÇÃO:
    // O header passa a estar dentro do bubble-panel.

    const wrapper = d3.select(container)
        .append("div")
        .attr("class", "bubble-wrapper");

    const panel = wrapper
        .append("div")
        .attr("class", "bubble-panel");

    const header = panel
        .append("div")
        .attr("class", "bubble-header");

    const buttons = header.selectAll("button")
        .data(fields)
        .enter()
        .append("button")
        .attr("type", "button")
        .attr("class", "bubble-button")
        .text(item => item.label)
        .on("click", function (event, item) {
            current = item;
            render();
        });

    // ALTERAÇÃO:
    // Criado bubble-plot dentro do painel.
    // O SVG fica abaixo dos botões.

    const plot = panel
        .append("div")
        .attr("class", "bubble-plot");

    const svg = plot.append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", "100%")
        .attr("height", "100%");

    function countsFor(state) {
        const activeBubbles = state.bubbles || [];

        const otherBubbles = activeBubbles.filter(
            bubble => bubble.field !== current.field
        );

        const key = [
            current.field,
            state.artists.slice().sort().join("|"),
            state.sets.slice().sort().join("|"),
            otherBubbles
                .map(bubble =>
                    bubble.field + "=" + bubble.value
                )
                .sort()
                .join("|")
        ].join("##");

        if (!bubbleCountsCache.has(key)) {
            const canUseGlobalCache =
                state.artists.length === 0
                && state.sets.length === 0
                && otherBubbles.length === 0;

            const allCounts = canUseGlobalCache
                ? Array.from(
                    data.cache.cardCountsByFieldValue.get(
                        current.field
                    ) || [],
                    ([value, count]) => [
                        value || "Unknown",
                        count
                    ]
                ).sort((a, b) => b[1] - a[1])
                : d3.rollups(
                    selectedCards(
                        data,
                        Object.assign({}, state, {
                            bubbles: otherBubbles
                        }),
                        false
                    ),
                    group => group.length,
                    card =>
                        card[current.field] || "Unknown"
                ).sort((a, b) => b[1] - a[1]);

            const counts = allCounts.length > maxBubbles
                ? allCounts
                    .slice(0, maxBubbles - 1)
                    .concat([
                        [
                            "Other",
                            d3.sum(
                                allCounts.slice(maxBubbles - 1),
                                ([, value]) => value
                            )
                        ]
                    ])
                : allCounts;

            const hiddenValues =
                allCounts.length > maxBubbles
                    ? allCounts
                        .slice(maxBubbles - 1)
                        .map(([value]) => value)
                    : [];

            data.cache.otherBubbleValuesCache.set(
                key,
                hiddenValues
            );

            bubbleCountsCache.set(key, counts);
        }

        return bubbleCountsCache.get(key);
    }

    function render() {
        buttons.classed(
            "active",
            item => item === current
        );

        svg.selectAll("*").remove();

        const counts = countsFor(lastState);

        if (counts.length === 0) {
            svg.append("text")
                .attr("x", width / 2)
                .attr("y", height / 2)
                .attr("text-anchor", "middle")
                .text("No cards");

            return;
        }

        const minCount = d3.min(
            counts,
            ([, value]) => value
        );

        const maxCount = d3.max(
            counts,
            ([, value]) => value
        );

        smallestDisplayedCount = minCount;

        const spread = Math.log10(
            maxCount / Math.max(1, minCount)
        );

        const layoutExponent = Math.max(
            0.45,
            Math.min(
                1,
                1 - Math.max(0, spread - 1) * 0.25
            )
        );

        const root = d3.pack()
            .size([width, height])
            .padding(2)(
                d3.hierarchy({
                    children: counts.map(
                        ([name, value]) => ({
                            name: name,
                            value: value,
                            layoutValue: Math.pow(
                                value,
                                layoutExponent
                            )
                        })
                    )
                }).sum(d => d.layoutValue || 0)
            );

        const leaves = root.leaves();

        const packedMinX = d3.min(
            leaves,
            d => d.x - radiusOf(d)
        );

        const packedMaxX = d3.max(
            leaves,
            d => d.x + radiusOf(d)
        );

        const horizontalScale = Math.min(
            1.35,
            (width - 12) / (packedMaxX - packedMinX)
        );

        leaves.forEach(function (node) {
            node.x = width / 2
                + (node.x - width / 2) * horizontalScale;
        });

        const simulation = d3.forceSimulation(leaves)
            .force(
                "x",
                d3.forceX(width / 2).strength(0.04)
            )
            .force(
                "y",
                d3.forceY(height / 2).strength(0.08)
            )
            .force(
                "charge",
                d3.forceManyBody().strength(-18)
            )
            .force(
                "collide",
                d3.forceCollide(
                    d => radiusOf(d) + 2
                ).iterations(4)
            )
            .stop();

        for (let tick = 0; tick < 250; tick += 1) {
            simulation.tick();
        }

        leaves.forEach(function (node) {
            const radius = radiusOf(node);

            node.x = Math.max(
                radius,
                Math.min(width - radius, node.x)
            );

            node.y = Math.max(
                radius,
                Math.min(height - radius, node.y)
            );
        });

        const activeBubbles = lastState.bubbles || [];

        const isSelected = d =>
            activeBubbles.some(
                bubble =>
                    bubble.field === current.field
                    && bubble.value === d.data.name
            );

        const nodes = svg.selectAll("g")
            .data(leaves)
            .enter()
            .append("g")
            .attr(
                "transform",
                d => `translate(${d.x},${d.y})`
            )
            .style("cursor", "pointer")
            .attr(
                "opacity",
                d =>
                    activeBubbles.length === 0
                    || isSelected(d)
                        ? 1
                        : 0.4
            )
            .on(
                "click",
                (event, d) =>
                    actions.selectBubble(
                        current.field,
                        d.data.name
                    )
            );

        nodes.append("title")
            .text(
                d =>
                    `${d.data.name}: ${d.data.value}`
            );

        nodes.append("circle")
            .attr("r", radiusOf)
            .attr(
                "fill",
                d => colorOf(d.data.name)
            )
            .attr("fill-opacity", 0.78)
            .attr("stroke", "black")
            .attr(
                "stroke-width",
                d => isSelected(d) ? 4 : 0
            );

        nodes
            .filter(
                d => radiusOf(d) > minLabelRadius
            )
            .append("text")
            .attr("text-anchor", "middle")
            .attr(
                "y",
                d =>
                    d.data.name.includes("/")
                        ? -radiusOf(d) * 0.32
                        : -radiusOf(d) * 0.1
            )
            .attr(
                "font-size",
                d => Math.min(
                    radiusOf(d) / 3,
                    18
                )
            )
            .attr("fill", "#222")
            .each(function (d) {
                const text = d3.select(this);

                nameLines(
                    d.data.name,
                    radiusOf(d)
                ).forEach(
                    function (line, index) {
                        text.append("tspan")
                            .attr("x", 0)
                            .attr(
                                "dy",
                                index === 0
                                    ? 0
                                    : "1.05em"
                            )
                            .text(line);
                    }
                );
            });

        nodes.append("text")
            .attr("text-anchor", "middle")
            .attr("y", d => {
                if (
                    radiusOf(d) <= minLabelRadius
                ) {
                    return 4;
                }

                return d.data.name.includes("/")
                    ? radiusOf(d) * 0.55
                    : radiusOf(d) * 0.35;
            })
            .attr(
                "font-size",
                d => Math.min(
                    radiusOf(d) / 2,
                    26
                )
            )
            .attr("fill", "#111")
            .text(d => d.data.value);
    }

    function update(state) {
        lastState = state;

        const activeBubble = (
            state.bubbles || []
        ).find(
            bubble =>
                bubble.field === current.field
        );

        if (activeBubble) {
            current = fields.find(
                item =>
                    item.field === activeBubble.field
            ) || current;
        }

        render();
    }

    return { update: update };
}
