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
}

function failedToSelectElement(){
    result.text("Failed to select a block in the allotted time.");
    
    goToStep4();
}

function selectElement(e) {
    clearTimeout(timer);
    
    var selectedItem = $(e.target).data("change-item");
    
    if (randomChange === selectedItem) {
        $("#start-test").show();
        result.html("<strong>Correct.</strong> You may continue practicing or start the test now.");
    } else {
        $("#start-test").hide();
        result.html("<strong>Incorrect.</strong> Please try again.")
    }
    
    goToStep4();
}

function goToStep2(e) {
    e.preventDefault();
    
    $("#step1").hide();
    $("#step2").show();
}


function goToStep3(e) {
    e.preventDefault();
    
    $("#step2").hide();
    $("#step3").show();
    
    setTimeout(changeElement, pauseForChange);
}

function goToStep4() {
    $("#step3").hide();
    $("#step4").show();
}

function resetChanges() {
    $(".coupe a").text("Rent a Coupe");        
    
    $(".logo img").attr("src", "/images/car.png");
    
    $(".hero img").attr("src", "/images/vehicle-hero.png");
}

function restartPractice() {
    resetChanges();
    
    $("#step4").hide();
    
    $("#step3").show();
    
    setTimeout(changeElement, pauseForChange);
}

$('a[href="#step2"]').on("click", goToStep2);
$('a[href="#step3"]').on("click", goToStep3);
$('a[href="#repeat"]').on("click", restartPractice);

$("#sample-page").on("click", selectElement);
