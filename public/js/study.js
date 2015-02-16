var PracticeTrial = (function($){
    var self = {};
    //changes array values correspond to data-change-item attributes in HTML
    var changes = [
        "wording",
        "logo",
        "image"
    ];

    var changeIndex;
    var randomChange;
    var result = $("#result");
    var pauseForChange = 3000;
    var pauseForSelection = 5000;
    var timer;

    self.init = function(){
        if(!$("#sample-page")){
            return;
        }


        setTimeout(changeElement, pauseForChange);

        $('a[href="#repeat"]').on("click", restartPractice);
    }

    function chooseRandomElement() {
        changeIndex = Math.floor(Math.random() * 3);
       
        return changes[changeIndex];
    }

    function changeElement(){
        randomChange = chooseRandomElement();
        
        if (randomChange == "wording") {
            $(".coupe a").text("Rent a Sports Car");        
        } else if (randomChange == "logo") {
            $(".logo img").attr("src", "/images/car-colored.png");
        } else {
            $(".hero img").attr("src", "/images/vehicle-hero-flipped.png");
        }

        $("#sample-page").on("click", selectElement);

        timer = setTimeout(failedToSelectElement, pauseForSelection);
    }

    function failedToSelectElement(){
        $("#start-test").hide();
        result.text("Time has run out for making a selection. Please try again.");
        
        showResult();
    }    

    function showResult() {
        $("#step3").hide();
        $("#step4").show();
    }

    function selectElement(e) {
        e.preventDefault();

        clearTimeout(timer);
        
        var selectedItem = $(e.target).data("change-item");
        
        if (randomChange === selectedItem) {
            $("#start-test").show();
            result.html("<strong>Correct.</strong> You may continue practicing or start the test now.");
        } else {
            $("#start-test").hide();
            result.html("<strong>Incorrect.</strong> Please try again.")
        }
        
        showResult();
    }    

    function restartPractice(e) {
        e.preventDefault();

        resetChanges();
        
        $("#step4").hide();
        
        $("#step3").show();
        
        setTimeout(changeElement, pauseForChange);
    }

    function resetChanges() {
        $(".coupe a").text("Rent a Coupe");                
        $(".logo img").attr("src", "/images/car.png");        
        $(".hero img").attr("src", "/images/vehicle-hero.png");
    }

    return self;
})(jQuery);

PracticeTrial.init();