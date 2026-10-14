function createCardGallery(container, data, actions) {
    const seriesGrouping = { label: "Series", field: "series" };
    const bubbleLabels = {
        name: "Card Name",
        rarity: "Rarity",
        type: "Type",
        subtype: "SubType"
    };
    let lastState = { artists: [], years: [], sets: [], bubbles: [] };
    let renderVersion = 0;
    // Keep the first paint small. Images are loaded separately when they are
    // close to the viewport, so this only controls how many placeholders are
    // added to the DOM at once.
    const cardsPerBatch = 18;
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

    const filterBubbles = header.append("div")
        .attr("class", "gallery-filter-bubbles");

    const scroller = panel.append("div").attr("class", "gallery-scroll");
    const content = scroller.append("div").attr("class", "gallery-content");
    const imageObserver = "IntersectionObserver" in window
        ? new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) {
                    return;
                }

                const image = entry.target;
                if (image.dataset.src) {
                    image.src = image.dataset.src;
                    delete image.dataset.src;
                }
                imageObserver.unobserve(image);
            });
        }, {
            root: scroller.node(),
            rootMargin: "500px 0px"
        })
        : null;

    function appendCardBatch(batch) {
        if (batch.version !== renderVersion || batch.next >= batch.cards.length) {
            return;
        }

        const fragment = document.createDocumentFragment();
        const end = Math.min(batch.next + cardsPerBatch, batch.cards.length);

        for (let index = batch.next; index < end; index += 1) {
            const card = batch.cards[index];
            const image = document.createElement("img");
            image.loading = "lazy";
            image.decoding = "async";
            image.dataset.src = card.image;
            image.alt = card.name;
            image.title = card.name + " - $" + card.Price;
            image.addEventListener("error", function () {
                image.style.visibility = "hidden";
            });
            fragment.appendChild(image);
        }

        batch.grid.node().appendChild(fragment);

        if (imageObserver) {
            batch.grid.node().querySelectorAll("img[data-src]").forEach(function (image) {
                imageObserver.observe(image);
            });
        } else {
            batch.grid.node().querySelectorAll("img[data-src]").forEach(function (image) {
                image.src = image.dataset.src;
                delete image.dataset.src;
            });
        }

        batch.next = end;
    }

    function loadVisibleBatches() {
        const scrollElement = scroller.node();
        const viewportBottom = scrollElement.getBoundingClientRect().bottom;
        const preloadDistance = scrollElement.clientHeight * 0.75;

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
    }

    function reserveGridSpace(grid, cards) {
        const element = grid.node();
        const columns = 3;
        const rows = Math.ceil(cards.length / columns);
        const styles = getComputedStyle(element);
        const gap = parseFloat(styles.rowGap) || 0;
        const columnGap = parseFloat(styles.columnGap) || gap;
        const cardWidth = Math.max(0, (element.clientWidth - columnGap * (columns - 1)) / columns);
        const cardHeight = cardWidth * 7 / 5;

        element.style.minHeight = `${rows * cardHeight + Math.max(0, rows - 1) * gap}px`;
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
        reserveGridSpace(grid, groupCards);
        queueCardBatch(grid, groupCards, version);
    }

    function render() {
        renderVersion += 1;
        const version = renderVersion;
        clearPendingBatches();
        if (imageObserver) {
            imageObserver.disconnect();
        }
        const bubbles = lastState.bubbles || [];
        const filters = lastState.artists.map(artist => ({
            key: "artist:" + artist,
            label: artist,
            field: "artist",
            value: artist
        })).concat(bubbles.map(bubble => ({
            key: bubble.field + ":" + bubble.value,
            label: bubbleLabels[bubble.field] + ": " + bubble.value,
            field: bubble.field,
            value: bubble.value
        })));

        filterBubbles.selectAll("button")
            .data(filters, filter => filter.key)
            .join(
                enter => enter.append("button")
                    .attr("type", "button")
                    .attr("class", "gallery-filter-bubble")
                    .on("click", function (event, filter) {
                        if (filter.field === "artist") {
                            actions.toggleArtist(filter.value);
                        } else {
                            actions.clearBubble(filter.field, filter.value);
                        }
                    }),
                update => update,
                exit => exit.remove()
            )
            .text(filter => filter.label);

        content.selectAll("*").remove();

        const hasSelectedFilter = lastState.artists.length > 0
            || lastState.sets.length > 0
            || bubbles.length > 0;

        if (!hasSelectedFilter) {
            content.append("div")
                .attr("class", "gallery-empty")
                .text("Select an artist or filter to see cards");
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

        const groups = d3.group(cards, card => card[seriesGrouping.field] || "Unknown");

        groups.forEach(function (groupCards, name) {
            const group = content.append("div").attr("class", "gallery-group");
            group.append("div").attr("class", "gallery-group-name").text(name);

            const grid = group.append("div").attr("class", "gallery-cards");

            queueGroupCards(grid, groupCards, version);
        });

        loadInitialVisibleBatches();
    }

    function update(state) {
        lastState = state;
        render();
    }

    return { update: update };
}
