function createCardGallery(container, data, actions) {
    const setGrouping = { label: "Set", field: "set" };
    const bubbleLabels = {
        name: "Card Name",
        rarity: "Rarity",
        type: "Type",
        subtype: "SubType"
    };
    let lastState = { artists: [], years: [], sets: [], bubbles: [] };
    let renderVersion = 0;
    const cardsPerBatch = 18;
    const maxConcurrentImages = 6;
    let pendingBatches = [];
    let imageQueue = [];
    let activeImageLoads = 0;
    const activeImageFinishes = new Set();

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

    const lazyObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
        const item = entry.target._lazy;
        if (!item) return;
        item.visible = entry.isIntersecting;
        if (entry.isIntersecting && !item.queued && item.version === renderVersion) {
            item.queued = true;
            queueImage(item.image, item.url, item.version, 0, item);
        }
    });
}, { root: scroller.node(), rootMargin: "300px 0px" });

    function pumpImageQueue() {
        while (activeImageLoads < maxConcurrentImages && imageQueue.length > 0) {
           const item = imageQueue.pop();

            if (item.lazy && !item.lazy.visible) { item.lazy.queued = false; continue; }

            activeImageLoads += 1;
            let finished = false;
            const finish = function () {
                if (finished) {
                    return;
                }
                finished = true;
                activeImageFinishes.delete(finish);
                activeImageLoads -= 1;
                pumpImageQueue();
            };
            const retry = function () {
                if (item.version !== renderVersion || !item.image.isConnected) {
                    finish();
                    return;
                }

                finish();
                if (item.attempt >= 3) {
                    item.image.style.visibility = "hidden";
                    return;
                }

                
                item.image.removeAttribute("src");
                    const nextAttempt = item.attempt + 1;
                    const useFallback = nextAttempt % 2 === 1 && item.image.dataset.fallback;
                window.setTimeout(function () {
                    queueImage(
                        item.image,
                        useFallback ? item.image.dataset.fallback : item.image.dataset.primary,
                        item.version,
                        nextAttempt
                    );
                }, 100 * nextAttempt);
            };

            activeImageFinishes.add(finish);
            item.image.addEventListener("load", finish, { once: true });
            item.image.addEventListener("error", retry, { once: true });
            item.image.src = item.url;

            if (item.image.complete) {
                window.setTimeout(finish, 0);
            }
        }
    }

    function queueImage(image, url, version, attempt) {
        imageQueue.push({
            image: image,
            url: url,
            version: version,
            attempt: attempt || 0
        });
        pumpImageQueue();
    }

    function cancelImageLoads() {
        lazyObserver.disconnect();
        imageQueue = [];
        Array.from(activeImageFinishes).forEach(function (finish) {
            finish();
        });
        content.selectAll("img").each(function () {
            this.onload = null;
            this.onerror = null;
            this.src = "";
        });
    }

    function appendCardBatch(batch) {
        if (batch.version !== renderVersion || batch.next >= batch.cards.length) {
            return;
        }

        const fragment = document.createDocumentFragment();
        const images = [];
        const end = Math.min(batch.next + cardsPerBatch, batch.cards.length);

        for (let index = batch.next; index < end; index += 1) {
            const card = batch.cards[index];
            const image = document.createElement("img");
            image.loading = "eager";
            image.decoding = "async";
            image.alt = card.name;
            image.title = card.name + " - $" + card.Price;
            image.dataset.primary = card.image; 
            if (card.imageFallback) {
                image.dataset.fallback = card.imageFallback;   
            }
            fragment.appendChild(image);
            images.push({ image: image, url: card.image });
        }

        batch.grid.node().appendChild(fragment);

       // images.forEach(function (item) {
         //   queueImage(item.image, item.url, batch.version);
        //});
        images.forEach(function (item) {
        item.image._lazy = { image: item.image, url: item.url, version: batch.version };
        lazyObserver.observe(item.image);
        });

        batch.next = end;
    }

    function scheduleBackgroundBatch(version) {
       const schedule = function (callback) {
            window.setTimeout(callback, 0);
        };

        schedule(function () {
            if (version !== renderVersion) {
                return;
            }

            const batch = pendingBatches[0];
            if (batch && batch.version === version) {
                appendCardBatch(batch);
                if (batch.next >= batch.cards.length) {
                    pendingBatches.shift();
                }
            }

            pendingBatches = pendingBatches.filter(function (item) {
                return item.version === version && item.next < item.cards.length;
            });

            if (pendingBatches.length > 0) {
                scheduleBackgroundBatch(version);
            }
        });
    }

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

    function queueGroupCards(grid, groupCards, version) {
        reserveGridSpace(grid, groupCards);
        queueCardBatch(grid, groupCards, version);
    }

    function render() {
        renderVersion += 1;
        const version = renderVersion;
        clearPendingBatches();
        cancelImageLoads();
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
}))).concat(lastState.sets.length === 0 ? [] : [{
    key: "sets",
    label: lastState.sets.length === 1 ? "Set: " + lastState.sets[0] : "Sets: " + lastState.sets.length + " selected",
    field: "sets",
    value: null
}]);

        filterBubbles.selectAll("button")
            .data(filters, filter => filter.key)
            .join(
                enter => enter.append("button")
                    .attr("type", "button")
                    .attr("class", "gallery-filter-bubble")
                    .on("click", function (event, filter) {
                        if (filter.field === "artist") {
                            actions.toggleArtist(filter.value);
                        } else if (filter.field === "sets") {
                                actions.selectSets([]);
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

        const groups = d3.group(cards, card => card[setGrouping.field] || "Unknown");

        groups.forEach(function (groupCards, name) {
            const group = content.append("div").attr("class", "gallery-group");
            group.append("div").attr("class", "gallery-group-name").text(name);

            const grid = group.append("div").attr("class", "gallery-cards");

            queueGroupCards(grid, groupCards, version);
        });

        if (cards.length <= cardsPerBatch) {
            pendingBatches.slice().forEach(function (batch) {
                appendCardBatch(batch);
            });
            pendingBatches = [];
        } else {
            scheduleBackgroundBatch(version);
        }
    }

    function update(state) {
        lastState = state;
        render();
    }

    return { update: update };
}
