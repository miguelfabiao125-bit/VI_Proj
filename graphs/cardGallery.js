function createCardGallery(container, data, actions) {
    const groupings = [
        { label: "Artist", field: "artist" },
        { label: "Series", field: "series" },
        { label: "Rarity", field: "rarity" }
    ];

    let current = groupings[1];         
    let lastState = { artists: [], years: [], sets: [], bubble: null };

    const panel = d3.select(container).append("div").attr("class", "gallery-panel");
    const header = panel.append("div").attr("class", "gallery-header");

    header.append("svg")
        .attr("class", "gallery-icon")
        .attr("viewBox", "0 0 24 24")
        .append("path")
        .attr("d", "M3 6H21M3 12H21M3 18H21")
        .attr("stroke", "black")
        .attr("stroke-width", 2.5)
        .attr("stroke-linecap", "round");

    const buttons = header.selectAll("button")
        .data(groupings)
        .enter()
        .append("button")
        .attr("type", "button")
        .attr("class", "gallery-button")
        .text(grouping => grouping.label)
        .on("click", function (event, grouping) {
            current = grouping;
            render();
        });

    const scroller = panel.append("div").attr("class", "gallery-scroll");
    const content = scroller.append("div").attr("class", "gallery-content");

    function render() {
        buttons.classed("active", grouping => grouping === current);
        content.selectAll("*").remove();

        if (lastState.artists.length === 0) {
            content.append("div")
                .attr("class", "gallery-empty")
                .text("Select an artist to see their cards");
            return;
        }

        const cards = selectedCards(data, lastState, false)
            .sort((a, b) => a.year - b.year);

        if (cards.length === 0) {
            content.append("div")
                .attr("class", "gallery-empty")
                .text("No cards match the current filters");
            return;
        }

        const groups = d3.group(cards, card => card[current.field] || "Unknown");

        groups.forEach(function (groupCards, name) {
            const group = content.append("div").attr("class", "gallery-group");
            group.append("div").attr("class", "gallery-group-name").text(name);

            const grid = group.append("div").attr("class", "gallery-cards");

            groupCards.forEach(function (card) {
                grid.append("img")
                    .attr("loading", "lazy")
                    .attr("src", card.image)
                    .attr("alt", card.name)
                    .attr("title", card.name + " - $" + card.Price)
                    .on("error", function () {
                        d3.select(this).style("visibility", "hidden");
                    });
            });
        });
    }

    function update(state) {
        lastState = state;
        render();
    }

    return { update: update };
}