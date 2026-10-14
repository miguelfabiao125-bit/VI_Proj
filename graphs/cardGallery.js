function createCardGallery(container, data, actions) {
    const groupings = [
        { label: "Artist", field: "artist" },
        { label: "Series", field: "series" },
        { label: "Rarity", field: "rarity" }
    ];

    let current = groupings[1];         
    let lastState = { artists: [], years: [], sets: [], bubble: null };
    let renderVersion = 0;
    const cardsPerBatch = 36;
    let pendingBatches = [];

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

    function appendCardBatch(batch) {
        if (batch.version !== renderVersion || batch.next >= batch.cards.length) {
            return;
        }

        const fragment = document.createDocumentFragment();
        const end = Math.min(batch.next + cardsPerBatch, batch.cards.length);

        batch.cards.slice(batch.next, end).forEach(function (card) {
            const image = document.createElement("img");
            image.loading = "lazy";
            image.decoding = "async";
            image.src = card.image;
            image.alt = card.name;
            image.title = card.name + " - $" + card.Price;
            image.addEventListener("error", function () {
                image.style.visibility = "hidden";
            });
            fragment.appendChild(image);
        });

        batch.grid.node().appendChild(fragment);
        batch.next = end;
    }

    function loadVisibleBatches() {
        const scrollElement = scroller.node();
        const viewportBottom = scrollElement.getBoundingClientRect().bottom;
        const preloadDistance = scrollElement.clientHeight * 1.5;

        pendingBatches.forEach(function (batch) {
            if (batch.version !== renderVersion || batch.next >= batch.cards.length) {
                return;
            }

            const gridTop = batch.grid.node().getBoundingClientRect().top;
            if (gridTop < viewportBottom + preloadDistance) {
                appendCardBatch(batch);
            }
        });

        pendingBatches = pendingBatches.filter(function (batch) {
            return batch.version === renderVersion && batch.next < batch.cards.length;
        });
    }

    scroller.on("scroll.gallery", function () {
        requestAnimationFrame(loadVisibleBatches);
    });

    function queueCardBatch(grid, cards, version) {
        const batch = { grid: grid, cards: cards, next: 0, version: version };
        pendingBatches.push(batch);
        appendCardBatch(batch);
    }

    function clearPendingBatches() {
        pendingBatches = [];
    }

    function loadInitialVisibleBatches() {
        requestAnimationFrame(function () {
            loadVisibleBatches();
        });
    }

    function queueGroupCards(grid, groupCards, version) {
        queueCardBatch(grid, groupCards, version);
        if (groupCards.length > cardsPerBatch) {
            loadInitialVisibleBatches();
        }
    }

    function render() {
        renderVersion += 1;
        const version = renderVersion;
        clearPendingBatches();
        buttons.classed("active", grouping => grouping === current);
        content.selectAll("*").remove();

        if (lastState.artists.length === 0) {
            content.append("div")
                .attr("class", "gallery-empty")
                .text("Select an artist to see their cards");
            return;
        }

        const cards = selectedCards(data, lastState, false).slice()
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

            queueGroupCards(grid, groupCards, version);
        });
    }

    function update(state) {
        lastState = state;
        render();
    }

    return { update: update };
}
