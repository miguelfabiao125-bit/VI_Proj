const bubbleCountsCache = new Map();

function createBubbleChart(container, data, actions) {
    const fields = [
        { label: "Card Name", field: "name" },
        { label: "Rarity",    field: "rarity" },
        { label: "Type",      field: "type" },
        { label: "SubType",   field: "subtype" }
    ];
    const maxBubbles = 15;
    const width = 500;
    const height = 400;

    const typeColors = {
        Metal: "#d6d3cf", Darkness: "#5f7b8a", Grass: "#3fae5a", Fairy: "#f2a7c3",
        Water: "#4fc3f7", Colorless: "#e8e8e8", Lightning: "#ffe94a",
        Fire: "#e8605a", Fighting: "#e8793a", Psychic: "#a05cb0", Dragon: "#a39d6e"
    };
    const otherColors = d3.scaleOrdinal(d3.schemeTableau10.concat(d3.schemeSet3));
    const colorOf = name => typeColors[name] || otherColors(name);

    const minLabelRadius = 22;   
    
    function shorten(name, radius) {
        const max = Math.floor(radius / 3.5);
        return name.length > max ? name.slice(0, max) + "…" : name;
    }

    let current = fields[1];
    let lastState = { artists: [], years: [], sets: [], bubble: null };

    const wrapper = d3.select(container).append("div").attr("class", "bubble-wrapper");
    const header = wrapper.append("div").attr("class", "bubble-header");

    const buttons = header.selectAll("button")
        .data(fields)
        .enter()
        .append("button")
        .attr("type", "button")
        .attr("class", "bubble-button")
        .text(item => item.label)
        .on("click", function (event, item) {
            current = item;
            actions.selectBubble(null, null); 
        });

    const panel = wrapper.append("div").attr("class", "bubble-panel");
    const svg = panel.append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", "100%")
        .attr("height", "100%");

    function countsFor(state) {
        const key = [
            current.field,
            state.artists.slice().sort().join("|"),
            state.sets.slice().sort().join("|")
        ].join("##");

        if (!bubbleCountsCache.has(key)) {
            const counts = d3.rollups(
                    selectedCards(data, state, true),
                    group => group.length,
                    card => card[current.field] || "Unknown"
                )
                .sort((a, b) => b[1] - a[1])
                .slice(0, maxBubbles);

            bubbleCountsCache.set(key, counts);
        }

        return bubbleCountsCache.get(key);
    }

    function render() {
        buttons.classed("active", item => item === current);
        svg.selectAll("*").remove();

        const counts = countsFor(lastState);

        if (counts.length === 0) {
            svg.append("text")
                .attr("x", width / 2).attr("y", height / 2)
                .attr("text-anchor", "middle")
                .text("No cards");
            return;
        }

        const root = d3.pack()
            .size([width, height])
            .padding(6)(
                d3.hierarchy({ children: counts.map(([name, value]) => ({ name, value })) })
                    .sum(d => d.value)
            );

        const bubble = lastState.bubble;
        const isSelected = d => bubble && bubble.field === current.field && bubble.value === d.data.name;

        const nodes = svg.selectAll("g")
            .data(root.leaves())
            .enter()
            .append("g")
            .attr("transform", d => `translate(${d.x},${d.y})`)
            .style("cursor", "pointer")
            .attr("opacity", d => (!bubble || isSelected(d)) ? 1 : 0.4)
            .on("click", (event, d) => actions.selectBubble(current.field, d.data.name));

        nodes.append("title").text(d => `${d.data.name}: ${d.data.value}`);

        nodes.append("circle")
            .attr("r", d => d.r)
            .attr("fill", d => colorOf(d.data.name))
            .attr("stroke", "black")
            .attr("stroke-width", d => isSelected(d) ? 4 : 0);

        nodes.filter(d => d.r > minLabelRadius)
            .append("text")
            .attr("text-anchor", "middle")
            .attr("y", d => -d.r * 0.1)
            .attr("font-size", d => Math.min(d.r / 3, 18))
            .attr("fill", "#222")
            .text(d => shorten(d.data.name, d.r));

        nodes.append("text")
            .attr("text-anchor", "middle")
            .attr("y", d => d.r > minLabelRadius ? d.r * 0.35 : 4)
            .attr("font-size", d => Math.min(d.r / 2, 26))
            .attr("fill", "#111")
            .text(d => d.data.value);
    }

    function update(state) {
        lastState = state;
        if (state.bubble) {
            current = fields.find(item => item.field === state.bubble.field) || current;
        }
        render();
    }

    return { update: update };
}