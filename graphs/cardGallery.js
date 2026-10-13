function createCardGallery(container, data, actions) {
    const groupings = [
        { label: "Artist", field: "artist" },
        { label: "Series", field: "series" },
        { label: "Rarity", field: "rarity" }
    ];

    let current = groupings[1];
    let selectedArtists = [];

    const panel = d3.select(container).append("div").attr("class", "gallery-panel");
    const header = panel.append("div").attr("class", "gallery-header");

    const icon = header.append("svg")
        .attr("class", "gallery-icon")
        .attr("viewBox", "0 0 24 24");

    [6, 12, 18].forEach(function (y) {
        icon.append("line")
            .attr("x1", 3)
            .attr("x2", 21)
            .attr("y1", y)
            .attr("y2", y)
            .attr("stroke", "black")
            .attr("stroke-width", 2.5)
            .attr("stroke-linecap", "round");
    });

    const buttons = header.selectAll("button")
        .data(groupings)
        .enter()
        .append("button")
        .attr("type", "button")
        .attr("class", "gallery-button")
        .text(grouping => grouping.label)
        .on("click", function (event, grouping) {
            current = grouping;
            showButtons();
            render();
        });

    const scroller = panel.append("div").attr("class", "gallery-scroll");
    const content = scroller.append("div").attr("class", "gallery-content");

    function showButtons() {
        buttons.classed("active", grouping => grouping === current);
    }

    function render() {
        content.selectAll("*").remove();

        const cards = selectedArtists
            .flatMap(name => data.artistIndex.get(name).cards)
            .sort((a, b) => a.year - b.year);

        if (cards.length === 0) {
            content.append("div")
                .attr("class", "gallery-empty")
                .text("Select an artist to see their cards");
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
                    .attr("src", "Images/" + parseInt(card.ImageID) + "_200w.jpg")
                    .attr("alt", card.name)
                    .attr("title", card.name + " - $" + card.Price)
                    .on("error", function () {
                        d3.select(this).style("visibility", "hidden");
                    });
            });
        });
    }

    function update(state) {
        selectedArtists = state.artists;
        render();
    }

    showButtons();

    return { update: update };
}