function createBarChart(container, data, actions) {
    const metric = "value";

    const topColors = ["#e33125", "#2aa9e0", "#2e9e4f"]; 
    const baseColor = "#9aa5b1";

    const groupings = [
        { label: "Generation", field: "generation" },
        { label: "Series",     field: "series" }
    ].filter(item => data.cards.some(card => card[item.field]));

    let current = groupings.find(item => item.field === "generation") || groupings[0];
    let path = [];   // ex.: [{field:"generation", name:"Third"}, {field:"series", name:"EX"}]
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

    const levels = ["generation", "series", "set"];
    const fieldTitle = { generation: "Generation", series: "Series", set: "Set" };
    const generationLabels = {
        First: "1st Gen", Second: "2nd Gen", Third: "3rd Gen", Fourth: "4th Gen",
        Fifth: "5th Gen", Sixth: "6th Gen", Seventh: "7th Gen", Eighth: "8th Gen", Ninth: "9th Gen"
    };
    const labelOf = (field, name) => field === "generation" ? (generationLabels[name] || name) : name;

    function cardsIn(steps) {
        return data.cards.filter(card => steps.every(step => keyOf(card, step.field) === step.name));
    }

    function setsOf(steps) {
        return Array.from(new Set(cardsIn(steps).map(card => card.set)));
    }

    // campo das barras/pills no nível atual
    function childField() {
        if (path.length === 0) {
            return current.field;
        }
        return levels[levels.indexOf(path[path.length - 1].field) + 1];
    }

    function groupsFor(field, steps) {
        const cacheKey = field + "|" + steps.map(step => step.field + "=" + step.name).join(">");
        if (!groupsCache.has(cacheKey)) {
            const groups = Array.from(
                d3.group(cardsIn(steps), card => keyOf(card, field)),
                ([name, cards]) => ({
                    field: field,
                    name: name,
                    label: labelOf(field, name),
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

    // texto do filtro que aparece na galeria
    function setsLabelOf(field, name) {
        return fieldTitle[field] + ": " + name;
    }

    // BARRAS: só selecionam/destacam; o gráfico nunca muda
    function selectGroup(group) {
        if (isSelected(group)) {
            const last = path[path.length - 1];
            actions.selectSets(
                path.length ? setsOf(path) : [],
                last ? setsLabelOf(last.field, last.name) : null
            );
        } else {
            actions.selectSets(group.sets, setsLabelOf(group.field, group.name));
        }
    }

    // PILLS: mudam o gráfico (entram no nível seguinte)
    function drillInto(group) {
        if (levels.indexOf(group.field) === levels.length - 1) {      // sets são o último nível
            selectGroup(group);
            return;
        }
        path = path.concat({ field: group.field, name: group.name });
        startIndex = 0;
        lastSelectedName = null;
        actions.selectSets(group.sets, setsLabelOf(group.field, group.name));
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
    if (item === current && path.length === 0) {
        return;
    }
    current = item;
    path = [];
    startIndex = 0;
    lastSelectedName = null;
    if (lastState.sets.length > 0) {
        actions.selectSets([]);
    } else {
        render();
    }
});

    strip.append("span").attr("class", "bar-divider");
    const crumbs = strip.append("div").attr("class", "bar-crumbs");
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

    // por baixo da faixa de pills: gráfico à esquerda, Top 3 à direita
    const lower = body.append("div").attr("class", "bar-lower");
    const plot = lower.append("div").attr("class", "bar-plot");
    const svg = plot.append("svg");

    const side = lower.append("div").attr("class", "bar-top");
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
            startIndex = 0;
            maxStart = 0;
            endIndex = 0;
            visibleCount = 0;
            updateScrollbar();
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

        const field = childField();
        title.text("Total Card Value per " + fieldTitle[field]
            + (path.length ? " (" + path.map(step => labelOf(step.field, step.name)).join(", ") + ")" : ""));

        const groups = groupsFor(field, path);
        const labelByName = new Map(groups.map(item => [item.name, item.label]));

        crumbs.selectAll("button")
            .data(path, step => step.field)
            .join("button")
            .attr("type", "button")
            .attr("class", "bar-pill active")
            .attr("title", "Go back")
            .text(step => labelOf(step.field, step.name))
            .on("click", function (event, step) {
                path = path.slice(0, path.indexOf(step));
                startIndex = 0;
                lastSelectedName = null;
                const last = path[path.length - 1];
                actions.selectSets(
                    path.length ? setsOf(path) : [],
                    last ? setsLabelOf(last.field, last.name) : null
                );
            });

        // ao nível dos sets não se enumeram pills: as barras já chegam
        itemsTrack.selectAll("button")
            .data(field === "set" ? [] : groups, item => item.name)
            .join("button")
            .attr("type", "button")
            .attr("class", item => "bar-pill" + (isSelected(item) ? " active" : ""))
            .text(item => item.label)
            .on("click", (event, item) => drillInto(item))
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
        const lastStep = path[path.length - 1];
        drawTop(top, selected ? selected.label : (lastStep ? labelOf(lastStep.field, lastStep.name) : null));

        const plotW = plot.node().clientWidth;
        const plotH = plot.node().clientHeight;
        if (!plotW || !plotH) {
            return;
        }

        // desenha num espaço virtual (largura de referência 1920) e o viewBox escala tudo
        const REF_WIDTH = 1920;
        const scale = container.closest(".card").clientWidth / REF_WIDTH;
        const width = plotW / scale;
        const height = plotH / scale;

        svg.attr("width", plotW)
            .attr("height", plotH)
            .attr("viewBox", `0 0 ${width} ${height}`);

        // tamanhos reais das letras (vêm do CSS)
function fontOf(className, inAxis) {
    const g = svg.append("g").attr("class", inAxis ? "bar-axis" : null);
    const px = parseFloat(
        getComputedStyle(g.append("text").attr("class", className).text("0").node()).fontSize
    ) || 10;
    g.remove();
    return px;
}
const fontPx = fontOf(null, true);               // texto dos eixos
const titleFont = fontOf("bar-axis-title", false);
const valueFont = fontOf("bar-value", false);

// largura real do maior número do eixo Y
const yFormat = d3.format("~s");
const yProbe = svg.append("g").attr("class", "bar-axis");
const tickLabelWidth = d3.max(
    d3.scaleLinear().domain([0, d3.max(groups, valueOf)]).nice().ticks(5),
    tick => yProbe.append("text").text(yFormat(tick)).node().getComputedTextLength()
) || 0;
yProbe.remove();

const axisGap = 9 + 0.4 * fontPx;                // 6 (tick) + 3 (padding) + folga
const baseLeft = axisGap + tickLabelWidth + titleFont;
const right = Math.max(valueFont * 1.5, 6);      // metade do maior valor sobre a última barra

const makeX = l => d3.scaleBand()
    .domain(groups.map(item => item.name))
    .range([0, Math.max(10, width - l - right)])
    .padding(0.15);

// quanto o nome rodado a 45º se estende para a esquerda do início do eixo X
function labelOverhang(size, xs) {
    const probe = svg.append("g").attr("class", "bar-axis");
    const need = d3.max(groups, item => {
        const w = probe.append("text")
            .style("font-size", size + "px")
            .text(item.label)
            .node().getComputedTextLength();
        const reach = (w + 0.8 * size) * Math.SQRT1_2 + 0.5 * size;
        return reach - (xs(item.name) + xs.bandwidth() / 2);
    });
    probe.remove();
    return Math.max(0, need);
}

// a margem esquerda cresce o necessário para o primeiro nome nunca ser cortado
const maxLeft = width * 0.3;
let left = baseLeft;
let x = makeX(left);
let labelFont = Math.min(fontPx, x.step() / 1.15);
for (let i = 0; i < 6; i += 1) {
    x = makeX(left);
    labelFont = Math.min(fontPx, x.step() / 1.15);
    const wanted = Math.max(baseLeft, Math.min(labelOverhang(labelFont, x) + 2, maxLeft));
    if (Math.abs(wanted - left) < 0.5) {
        break;
    }
    left = wanted;
}
x = makeX(left);
// se mesmo com o limite não couber, a letra encolhe
for (let i = 0; i < 8 && labelOverhang(labelFont, x) + 2 > left; i += 1) {
    labelFont *= 0.92;
}

const showValues = x.step() >= valueFont * 3;

// mede a altura dos nomes rodados a 45º para um dado tamanho de letra
function measureLabels(size) {
    const probe = svg.append("g").attr("class", "bar-axis");
    groups.forEach(item => probe.append("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end")
        .style("font-size", size + "px")
        .text(item.label));
    const h = d3.max(probe.selectAll("text").nodes(),
        node => node.getBoundingClientRect().height) / scale;
    probe.remove();
    return h + 0.9 * size;
}

// os nomes aparecem sempre: se não couberem na vertical, a letra encolhe só o necessário
let labelSpace = measureLabels(labelFont);
const maxLabelSpace = height * 0.4;
if (labelSpace > maxLabelSpace) {
    labelFont *= maxLabelSpace / labelSpace;
    labelSpace = measureLabels(labelFont);
}

const margin = {
    top: valueFont * 1.6 + 2,                    // espaço para o valor da barra mais alta
    right: right,
    bottom: labelSpace,
    left: left
};
const chartHeight = height - margin.top - margin.bottom;
const yTickCount = Math.max(2, Math.min(5, Math.floor(chartHeight / (fontPx * 3))));

        const y = d3.scaleLinear()
            .domain([0, d3.max(groups, valueOf)]).nice()
            .range([chartHeight, 0]);

        const chart = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        chart.append("g")
            .attr("class", "bar-axis")
            .call(d3.axisLeft(y).ticks(yTickCount).tickFormat(d3.format("~s")));

        chart.append("g")
            .attr("class", "bar-axis")
            .attr("transform", `translate(0,${chartHeight})`)
            .call(d3.axisBottom(x)
                .tickSize(3)
                .tickValues(x.domain())
                .tickFormat(name => labelByName.get(name)))
            .selectAll("text")
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "end")
            .style("font-size", labelFont + "px")
            .attr("dx", "-0.4em")
            .attr("dy", "0.2em");

        const yTitle = chart.append("text")
            .attr("class", "bar-axis-title")
            .attr("transform", "rotate(-90)")
            .attr("x", -chartHeight / 2)
            .attr("y", -(axisGap + tickLabelWidth))
            .attr("text-anchor", "middle")
            .text(metric === "count" ? "Number of cards" : "Value ($)");

        if (yTitle.node().getComputedTextLength() > chartHeight) {
            yTitle.remove();
        }

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
            .on("click", (event, item) => drillInto(item))
            .append("title")
            .text(item => item.label + ": " + (metric === "count"
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
                .attr("y", item => y(valueOf(item)) - 0.3 * valueFont)
                .attr("text-anchor", "middle")
                .style("pointer-events", "none")
                .text(item => d3.format(".3~s")(valueOf(item)));
        } else if (selected) {
            chart.append("text")
                .attr("class", "bar-value")
                .attr("x", x(selected.name) + x.bandwidth() / 2)
                .attr("y", y(valueOf(selected)) - 0.3 * valueFont)
                .attr("text-anchor", "middle")
                .text(d3.format(".3~s")(valueOf(selected)));
        }
    }

    function update(state) {
        lastState = state;
        // Reset Filters (ou qualquer limpeza de sets) fecha os níveis abertos
        if (path.length > 0 && state.sets.length === 0) {
            path = [];
            startIndex = 0;
            lastSelectedName = null;
        }
        render();
    }

    return { update: update };
}