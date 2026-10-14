function createArtistPair(container, data) {
    const pair = d3.select(container).append("div").attr("class", "pair");
    const star = pair.append("span").attr("class", "pair-star").text("★");
    const body = pair.append("div").attr("class", "pair-body");
    const frame = body.append("div").attr("class", "pair-frame");

    function showMessage(message) {
        frame.classed("empty", true).text(message);
        star.style("visibility", "hidden");
    }

    function showArtist(artist) {
        const favorite = data.cache.mostFamousHighestEarningByArtist.get(artist);
        const bestCard = data.cache.cardsById.get(favorite.cardId);

        frame.classed("empty", false).text("");
        frame.append("img")
            .attr("src", bestCard.image)
            .attr("alt", bestCard.name)
            .attr("title", bestCard.name + " - $" + bestCard.Price)
            .on("error", function () {
                d3.select(this).remove();
                frame.text("Image unavailable");
            });

        star.style("visibility", "visible");
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
