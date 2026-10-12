function createArtistPair(container, data) {
    const cardsByArtist = d3.group(data.cards, card => card.artist);

    const pair = d3.select(container).append("div").attr("class", "pair");
    const star = pair.append("span").attr("class", "pair-star").text("★");
    const body = pair.append("div").attr("class", "pair-body");
    const frame = body.append("div").attr("class", "pair-frame");
    const nameLabel = body.append("div").attr("class", "pair-name");

    function showMessage(message) {
        frame.classed("empty", true).text(message);
        nameLabel.text("");
        star.style("visibility", "hidden");
    }

    function showArtist(artist) {
        const artistCards = cardsByArtist.get(artist);
        const bestCard = d3.greatest(artistCards, card => +card.Price);

        const nameCounts = d3.rollups(artistCards, group => group.length, card => card.name);
        const topName = d3.greatest(nameCounts, entry => entry[1])[0];

        frame.classed("empty", false).text("");
        frame.append("img")
            .attr("src", "Images/" + parseInt(bestCard.ImageID) + "_200w.jpg")
            .attr("alt", bestCard.name)
            .attr("title", bestCard.name + " - $" + bestCard.Price)
            .on("error", function () {
                d3.select(this).remove();
                frame.text(bestCard.name);
            });

        nameLabel.text(topName);
        star.style("visibility", bestCard.name === topName ? "visible" : "hidden");
    }

    function update(state) {
        const count = state.artists.length;

        if (count === 1) {
            showArtist(state.artists[0]);
        } else if (count === 0) {
            showMessage("Click on an Artist");
        } else {
            showMessage("Select only one Artist");
        }
    }

    return { update: update };
}