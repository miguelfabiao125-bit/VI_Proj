function createBarChart(container, data, actions) {
    const metric = "value";

    const topColors = ["#e33125", "#2aa9e0", "#2e9e4f"]; 
    const baseColor = "#9aa5b1";

    const groupings = [
        { label: "Generation", field: "generation" },
        { label: "Series",     field: "series" }
    ].filter(item => data.cards.some(card => card[item.field]));

    let current = groupings.find(item => item.field === "generation") || groupings[0];
    let drill = null;
    let lastState = { artists: [], years: [], sets: [], bubbles: [] };
    let startIndex = 0;      
    let maxStart = 0;
    let visibleCount = 0;
    let endIndex = 0;
    let dragging = false;
    let lastSelectedName = null;
    const groupsCache = new Map();

    const priceOf = card => Number.isFinite(+card.Price) ? +card.Price : 0;
    const valueOf = item => item[metric];
    const keyOf = (card, field) => (card[field] || "Unknown").trim();

    function groupsFor(field, drillName) {
    const cacheKey = field + "|" + (drillName || "");
    if (!groupsCache.has(cacheKey)) {
        const source = drillName
            ? data.cards.filter(card => keyOf(card, "generation") === drillName)
            : data.cards;
        const groups = Array.from(
            d3.group(source, card => keyOf(card, field)),
            ([name, cards]) => ({
                name: name,
                count: cards.length,
                value: d3.sum(cards, priceOf),
                sets: Array.from(new Set(cards.map(card => card.set))),
                year: d3.min(cards, card => card.year)
            })
        ).sort((a, b) => a.year - b.year || d3.ascending(a.name, b.name));
        groupsCache.set(cacheKey, groups);
    }
    return groupsCache.get(cacheKey);
}

    function topArtists(setNames) {
        const cards = setNames
            .flatMap(name => data.cache.setCardIdsBySet.get(name) || [])
            .map(id => data.cache.cardsById.get(id));

        return d3.rollups(
    cards,
    group => ({
        count: group.length,
        value: d3.sum(group, priceOf),
        bestCard: d3.greatest(group, priceOf)   
    }),
    card => card.artist
)
    .map(([artist, sums]) => ({
        artist: artist,
        count: sums.count,
        value: sums.value,
        bestCard: sums.bestCard
    }))
    .sort((a, b) => b[metric] - a[metric] || d3.ascending(a.artist, b.artist))
    .slice(0, 3);
    }

    function isSelected(group) {
        return lastState.sets.length === group.sets.length
            && group.sets.every(name => lastState.sets.includes(name));
    }

    function toggleGroup(group) {
    if (drill) {
        // dentro de uma geração: clicar numa série filtra; clicar de novo volta aos sets da geração
        const generation = groupsFor("generation").find(item => item.name === drill);
        actions.selectSets(isSelected(group) ? generation.sets : group.sets);
        return;
    }
    if (current.field === "generation" && !isSelected(group)) {
        drill = group.name;          // abre a geração
        startIndex = 0;
        lastSelectedName = null;
        actions.selectSets(group.sets);
        return;
    }
    actions.selectSets(isSelected(group) ? [] : group.sets);
}

    const wrapper = d3.select(container).append("div").attr("class", "bar-wrapper");
    const body = wrapper.append("div").attr("class", "bar-body");

    const main = body.append("div").attr("class", "bar-main");

    const scrollbar = main.append("div").attr("class", "bar-scroll");
    const title = main.append("div").attr("class", "chart-title");

    const arrowIcon = direction => direction < 0
        ? '<svg viewBox="0 0 10 10"><path d="M7 1 L2 5 L7 9 Z"/></svg>'
        : '<svg viewBox="0 0 10 10"><path d="M3 1 L8 5 L3 9 Z"/></svg>';

    const leftArrow = scrollbar.append("button")
        .attr("type", "button")
        .attr("class", "bar-arrow")
        .attr("aria-label", "Previous")
        .html(arrowIcon(-1))
        .on("click", () => moveBy(-1));

    const track = scrollbar.append("div").attr("class", "bar-scroll-track");
    const thumb = track.append("div").attr("class", "bar-scroll-thumb");

    const rightArrow = scrollbar.append("button")
        .attr("type", "button")
        .attr("class", "bar-arrow")
        .attr("aria-label", "Next")
        .html(arrowIcon(1))
        .on("click", () => moveBy(1));

    const strip = main.append("div").attr("class", "bar-strip");

    const buttons = strip.selectAll(".bar-group")
        .data(groupings)
        .enter()
        .append("button")
        .attr("type", "button")
        .attr("class", "bar-pill bar-group")
        .text(item => item.label)
        .on("click", function (event, item) {
    if (item === current && !drill) {
        return;
    }
    current = item;
    drill = null;
    startIndex = 0;
    lastSelectedName = null;
    if (lastState.sets.length > 0) {
        actions.selectSets([]);
    } else {
        render();
    }
});

    strip.append("span").attr("class", "bar-divider");
    const drillLabel = strip.append("button")
    .attr("type", "button")
    .attr("class", "bar-pill active")
    .style("display", "none")
    .attr("title", "Back to all generations")
    .on("click", function () {
        drill = null;
        startIndex = 0;
        lastSelectedName = null;
        actions.selectSets([]);
    });
    const itemsHost = strip.append("div").attr("class", "bar-items");
    const itemsTrack = itemsHost.append("div").attr("class", "bar-items-track");

    itemsHost.on("wheel", function (event) {
        const step = Math.sign(event.deltaY || event.deltaX);
        if (!step || maxStart === 0) {
            return;
        }
        event.preventDefault();
        moveBy(step);
    });

    const plot = main.append("div").attr("class", "bar-plot");
    const svg = plot.append("svg");

     const side = body.append("div").attr("class", "bar-top");
    side.append("div").attr("class", "bar-top-title").text("Top 3");
    const subtitle = side.append("div").attr("class", "bar-top-subtitle");
    const topList = side.append("div").attr("class", "bar-top-list");

    function moveBy(step) {
        const next = Math.max(0, Math.min(maxStart, startIndex + step));
        if (next !== startIndex) {
            startIndex = next;
            layoutPills();
        }
    }

    function layoutPills() {
        const pills = itemsTrack.selectAll("button").nodes();
        if (pills.length === 0) {
            return;
        }

        const available = itemsHost.node().clientWidth;
        const lefts = pills.map(pill => pill.offsetLeft);
        const rights = pills.map(pill => pill.offsetLeft + pill.offsetWidth);
        const last = pills.length - 1;

         let first = last;
        while (first > 0 && rights[last] - lefts[first - 1] <= available) {
            first -= 1;
        }
        maxStart = first;
        startIndex = Math.max(0, Math.min(maxStart, startIndex));

        endIndex = startIndex;
        while (endIndex < last && rights[endIndex + 1] - lefts[startIndex] <= available) {
            endIndex += 1;
        }
        visibleCount = endIndex - startIndex + 1;

        itemsTrack.style("transform", `translateX(${-lefts[startIndex]}px)`);
        pills.forEach(function (pill, index) {
            pill.classList.toggle("is-out", index < startIndex || index > endIndex);
        });

        updateScrollbar();
    }

    function updateScrollbar() {
        const trackWidth = track.node().clientWidth;
        const total = Math.max(1, itemsTrack.selectAll("button").size());
        const thumbWidth = Math.max(trackWidth * 0.12, trackWidth * Math.min(1, visibleCount / total));

        thumb.style("width", thumbWidth + "px");
        scrollbar.classed("disabled", maxStart === 0);
        leftArrow.property("disabled", startIndex <= 0);
        rightArrow.property("disabled", startIndex >= maxStart);

        if (dragging) {
            return;   
        }
        const ratio = maxStart > 0 ? startIndex / maxStart : 0;
        thumb.style("transform", `translateX(${ratio * (trackWidth - thumbWidth)}px)`);
    }

     function dragTo(event) {
        const rect = track.node().getBoundingClientRect();
        const thumbWidth = thumb.node().offsetWidth;
        const room = Math.max(0, rect.width - thumbWidth);
        const x = Math.max(0, Math.min(room, event.clientX - rect.left - thumbWidth / 2));
        const ratio = room > 0 ? x / room : 0;

        thumb.style("transform", `translateX(${x}px)`);

        const index = Math.round(ratio * maxStart);
        if (index !== startIndex) {
            startIndex = index;
            layoutPills();
        }
    }

    track
        .on("pointerdown", function (event) {
            if (maxStart === 0) {
                return;
            }
            dragging = true;
            track.classed("dragging", true);
            track.node().setPointerCapture(event.pointerId);
            dragTo(event);
        })
        .on("pointermove", function (event) {
            if (dragging) {
                dragTo(event);
            }
        })
        .on("pointerup pointercancel", function () {
            dragging = false;
            track.classed("dragging", false);
            updateScrollbar();   
        });


    function drawTop(top, selectedName) {
        const chosen = new Set(lastState.artists);
        topList.selectAll("*").remove();

        const hasSelection = lastState.sets.length > 0;
        subtitle.text(hasSelection ? (selectedName || lastState.sets.length + " sets") : "");

        const rows = hasSelection ? top : [null, null, null];

        rows.forEach(function (item, index) {
            const row = topList.append("button")
                .attr("type", "button")
                .attr("class", "bar-top-row"
                    + (item && chosen.has(item.artist) ? " selected" : "")
                    + (item ? "" : " placeholder"))
                .attr("title", item ? "Click to select " + item.artist : "")
                .on("click", () => { if (item) actions.toggleArtist(item.artist); });

            const slot = row.append("span").attr("class", "bar-top-slot");
            slot.append("span")
                .attr("class", "bar-top-swatch")
                .style("background", topColors[index]);

            const frame = slot.append("span").attr("class", "bar-top-card");

            const text = row.append("span").attr("class", "bar-top-text");

            if (!item) {
                text.append("span").attr("class", "bar-top-name").text("Artist");
                text.append("span").text("N° of cards");
                text.append("span").text("Value");
                return;
            }

            const card = item.bestCard;
if (card) {
    frame.append("img")
        .attr("src", card.image)
        .attr("alt", card.name)
        .attr("title", card.name + " - $" + card.Price)
        .on("error", function () {
            if (!this.dataset.triedFallback && card.imageFallback) {
                this.dataset.triedFallback = "1";
                this.src = card.imageFallback;
                return;
            }
            d3.select(this).remove();
        });
}

            text.append("span").attr("class", "bar-top-name").text(item.artist);
            text.append("span").text(d3.format(",")(item.count) + " cards");
            text.append("span").text("$" + d3.format(",.0f")(item.value));
        });
    }

    function render() {
        buttons.classed("active", item => item === current);
        title.text(drill
    ? "Total Card Value per Series (Generation " + drill + ")"
    : "Total Card Value per " + current.label);

        const groups = groupsFor(current.field === "generation" && drill ? "series" : current.field, drill);
drillLabel.style("display", drill ? null : "none")
    .text(drill ? "Generation " + drill : "");

    strip.classed("is-drilled", !!drill);

        itemsTrack.selectAll("button")
            .data(groups, item => item.name)
            .join("button")
            .attr("type", "button")
            .attr("class", item => "bar-pill" + (isSelected(item) ? " active" : ""))
            .text(item => item.name)
            .on("click", (event, item) => toggleGroup(item))
            .order();

        layoutPills();

        const selectedIndex = groups.findIndex(isSelected);
        const selectedName = selectedIndex >= 0 ? groups[selectedIndex].name : null;
        if (selectedName !== lastSelectedName) {
            lastSelectedName = selectedName;
            if (selectedIndex >= 0 && (selectedIndex < startIndex || selectedIndex > endIndex)) {
                startIndex = Math.min(selectedIndex, maxStart);
                layoutPills();
            }
        }

        svg.selectAll("*").remove();

        const selected = groups.find(isSelected);
        const top = topArtists(lastState.sets);
        drawTop(top, selected ? selected.name : (drill ? "Generation " + drill : null));

        const width = plot.node().clientWidth;
        const height = plot.node().clientHeight;
        if (!width || !height) {
            return;
        }
        svg.attr("width", width).attr("height", height);

        const left = 50;
        const right = 10;
        const x = d3.scaleBand()
            .domain(groups.map(item => item.name))
            .range([0, width - left - right])
            .padding(0.15);

        const showLabels = x.step() >= 15;
        const showValues = x.step() >= 28;

         let labelSpace = 28;
        if (showLabels) {
            const probe = svg.append("g").attr("class", "bar-axis");
            groups.forEach(item => probe.append("text")
                .attr("transform", "rotate(-45)")
                .style("text-anchor", "end")
                .text(item.name));
            labelSpace = d3.max(probe.selectAll("text").nodes(),
                node => node.getBoundingClientRect().height) + 12;
            probe.remove();
        }

        const margin = {
            top: 16,
            right: right,
            bottom: Math.min(labelSpace, height * 0.45),
            left: left
        };
        const chartHeight = height - margin.top - margin.bottom;

        const y = d3.scaleLinear()
            .domain([0, d3.max(groups, valueOf)]).nice()
            .range([chartHeight, 0]);

        const chart = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        chart.append("g")
            .attr("class", "bar-axis")
            .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("~s")));

        chart.append("g")
            .attr("class", "bar-axis")
            .attr("transform", `translate(0,${chartHeight})`)
            .call(d3.axisBottom(x)
                .tickSize(3)
                .tickValues(showLabels ? x.domain() : [])
                .tickFormat(name => name))
            .selectAll("text")
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "end")
            .attr("dx", "-0.4em")
            .attr("dy", "0.2em");

        chart.append("text")
            .attr("class", "bar-axis-title")
            .attr("transform", "rotate(-90)")
            .attr("x", -chartHeight / 2)
            .attr("y", -38)
            .attr("text-anchor", "middle")
            .text(metric === "count" ? "Number of cards" : "Value ($)");

        const hasSelection = lastState.sets.length > 0;
        chart.selectAll(".bar")
            .data(groups)
            .enter()
            .append("rect")
            .attr("class", "bar")
            .attr("x", item => x(item.name))
            .attr("width", x.bandwidth())
            .attr("y", item => y(valueOf(item)))
            .attr("height", item => chartHeight - y(valueOf(item)))
            .attr("fill", baseColor)
            .attr("opacity", item => (!hasSelection || isSelected(item)) ? 1 : 0.45)
            .style("cursor", "pointer")
            .on("click", (event, item) => toggleGroup(item))
            .append("title")
            .text(item => item.name + ": " + (metric === "count"
                ? d3.format(",.0f")(valueOf(item)) + " cards"
                : "$" + d3.format(",.0f")(valueOf(item))));

         if (selected) {
            const topSum = d3.sum(top, item => item[metric]);
            let accumulated = Math.max(0, valueOf(selected) - topSum);

            top.forEach(function (item, index) {
                chart.append("rect")
                    .attr("x", x(selected.name))
                    .attr("width", x.bandwidth())
                    .attr("y", y(accumulated + item[metric]))
                    .attr("height", y(accumulated) - y(accumulated + item[metric]))
                    .attr("fill", topColors[index])
                    .style("pointer-events", "none");
                accumulated += item[metric];
            });
        }

        if (showValues) {
            chart.selectAll(".bar-value")
                .data(groups)
                .enter()
                .append("text")
                .attr("class", "bar-value")
                .attr("x", item => x(item.name) + x.bandwidth() / 2)
                .attr("y", item => y(valueOf(item)) - 4)
                .attr("text-anchor", "middle")
                .style("pointer-events", "none")
                .text(item => d3.format(".3~s")(valueOf(item)));
        } else if (selected) {
            chart.append("text")
                .attr("class", "bar-value")
                .attr("x", x(selected.name) + x.bandwidth() / 2)
                .attr("y", y(valueOf(selected)) - 6)
                .attr("text-anchor", "middle")
                .text(d3.format(".3~s")(valueOf(selected)));
        }
    }

    function update(state) {
    lastState = state;
    // Reset Filters (ou qualquer limpeza de sets) fecha a geração aberta
    if (drill && state.sets.length === 0) {
        drill = null;
        startIndex = 0;
        lastSelectedName = null;
    }
    render();
}

    return { update: update };
}