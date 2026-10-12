function createLineChart(container, artists, onSelect) {

    const margin = { top: 28, right: 30, bottom: 45, left: 55 };
    const transitionTime = 320;
    const yAxisSteps = [1, 2, 5, 10, 25, 50, 100, 200, 311];
    const yScaleConstant = 1;
    const bandColor = "#bae6f7";

    const lineStyles = {
        normal:   { stroke: "lightgray", width: 1.5, opacity: 0.7 },
        dimmed:   { stroke: "lightgray", width: 1.5, opacity: 0.4 },
        selected: { stroke: "red",       width: 3,   opacity: 1 }
    };

    const width = container.clientWidth;
    const height = container.clientHeight;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;


    const svg = d3.select(container)
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    svg.append("defs")
        .append("clipPath")
        .attr("id", "line-chart-clip")
        .append("rect")
        .attr("x", -2)
        .attr("y", -2)
        .attr("width", chartWidth + 4)
        .attr("height", chartHeight + 4);

    const chart = svg.append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");


    const allPoints = artists.flatMap(artist => artist.values);
    const maxCards = d3.max(allPoints, point => point.cards);

    const x = d3.scaleLinear()
        .domain(d3.extent(allPoints, point => point.year))
        .range([0, chartWidth]);

    const y = d3.scaleSymlog()
        .constant(yScaleConstant)
        .domain([1, maxCards])
        .range([chartHeight, 0]);

    const fullYTicks = yAxisSteps.filter(step => step <= maxCards);

    const fullYDomain = y.domain();
    const fullYRange = y.range();
    const fullXDomain = x.domain();
    let yTicks = fullYTicks;


    chart.append("text")
        .attr("x", chartWidth / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .text("Pokémon Cards Produced per Artist over Time");

    const xAxisGroup = chart.append("g")
        .attr("transform", "translate(0," + chartHeight + ")");

    const yAxisGroup = chart.append("g");

    chart.append("text")
        .attr("x", chartWidth / 2)
        .attr("y", chartHeight + 38)
        .attr("text-anchor", "middle")
        .text("Year");

    chart.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -chartHeight / 2)
        .attr("y", -40)
        .attr("text-anchor", "middle")
        .text("Number of Cards");

    function drawAxes(time) {
        const yearRange = x.domain()[1] - x.domain()[0];
        const numberOfXTicks = Math.min(10, Math.max(1, Math.floor(yearRange)));

        const xAxis = d3.axisBottom(x)
            .ticks(numberOfXTicks)
            .tickFormat(d3.format("d"));

        const yAxis = d3.axisLeft(y)
            .tickValues(yTicks);

        xAxisGroup.transition().duration(time).call(xAxis);
        yAxisGroup.transition().duration(time).call(yAxis);
    }

    drawAxes(0);


    const bandGroup = chart.append("g")
        .attr("clip-path", "url(#line-chart-clip)");

    const bandRect = bandGroup.append("rect")
        .attr("height", chartHeight)
        .attr("fill", bandColor)
        .attr("opacity", 0.85)
        .style("display", "none");

    let bandYears = [];

    function drawBand(time) {
        if (bandYears.length === 0) {
            bandRect.style("display", "none");
            return;
        }

        const firstYear = d3.min(bandYears);
        const lastYear = d3.max(bandYears);

        let padding = 0;
        if (firstYear === lastYear) {
            padding = 0.4;
        }

        const left = x(firstYear - padding);
        const right = x(lastYear + padding);
        const bandWidth = Math.max(right - left, 2);

        const wasHidden = bandRect.style("display") === "none";
        bandRect.style("display", null);

        if (wasHidden) {
            bandRect.attr("x", left).attr("width", bandWidth);
        } else {
            bandRect.transition().duration(time)
                .attr("x", left)
                .attr("width", bandWidth);
        }
    }


    const lineGenerator = d3.line()
        .x(point => x(point.year))
        .y(point => y(point.cards));

    function pointsOf(item) {
        if (item.values.length === 1) {
            return [item.values[0], item.values[0]];
        }
        return item.values;
    }

    function applyStyle(selection, style) {
        return selection
            .attr("stroke", style.stroke)
            .attr("stroke-width", style.width)
            .attr("opacity", style.opacity);
    }

    const lines = chart.selectAll(".artist-line")
        .data(artists)
        .enter()
        .append("path")
        .attr("class", "artist-line")
        .attr("clip-path", "url(#line-chart-clip)")
        .attr("d", item => lineGenerator(pointsOf(item)))
        .attr("fill", "none")
        .attr("stroke-linecap", "round")
        .style("cursor", "pointer");

    applyStyle(lines, lineStyles.normal);

    lines.on("click", function (event, item) {
        onSelect(item.artist);
    });

    const artistLabel = chart.append("text")
        .attr("x", chartWidth - 10)
        .attr("y", 20)
        .attr("text-anchor", "end")
        .attr("font-size", "16px")
        .attr("fill", "red")
        .style("pointer-events", "none");


    function redrawEverything() {
        drawAxes(transitionTime);
        drawBand(transitionTime);
        lines.transition().duration(transitionTime)
            .attr("d", item => lineGenerator(pointsOf(item)));
    }

    function zoomTo(selection) {
        const left = selection[0][0];
        const top = selection[0][1];
        const right = selection[1][0];
        const bottom = selection[1][1];

        const firstYear = x.invert(left);
        const lastYear = x.invert(right);
        const lowestValue = y.invert(bottom);
        const highestValue = y.invert(top);

        if (lastYear - firstYear < 1 || highestValue - lowestValue <= 0) {
            return;
        }

        x.domain([firstYear, lastYear]);
        y.domain([Math.max(1, lowestValue), highestValue]).range([chartHeight, 0]);

        const ticksInside = fullYTicks.filter(tick => tick >= lowestValue && tick <= highestValue);
        if (ticksInside.length >= 3) {
            yTicks = ticksInside;
        } else {
            yTicks = d3.ticks(lowestValue, highestValue, 5)
                .filter(tick => tick >= 1);
        }

        redrawEverything();
    }

    function resetZoom() {
        x.domain(fullXDomain);
        y.domain(fullYDomain).range(fullYRange);
        yTicks = fullYTicks;
        redrawEverything();
    }

    const brush = d3.brush()
        .extent([[0, 0], [chartWidth, chartHeight]])
        .on("end", function (event) {
            if (!event.selection) {
                return;
            }
            d3.select(this).call(brush.move, null);
            zoomTo(event.selection);
        });

    const brushGroup = chart.insert("g", ".artist-line")
        .call(brush);

    brushGroup.select(".selection")
        .attr("fill-opacity", 0.05)
        .attr("stroke", "red")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "5,3");

    svg.on("dblclick", resetZoom);


    function highlight(artistName) {
        const selectedLines = lines.filter(item => item.artist === artistName);
        const otherLines = lines.filter(item => item.artist !== artistName);

        applyStyle(otherLines, lineStyles.dimmed);
        applyStyle(selectedLines, lineStyles.selected).raise();

        artistLabel.text(artistName);
    }

    function highlightYears(years) {
        bandYears = years;
        drawBand(transitionTime);
    }

    return { highlight: highlight, highlightYears: highlightYears };
}
