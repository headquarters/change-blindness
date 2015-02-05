var Trial = (function($){
    var self = {};
    var pageType;
    var changeLocation;
    var changeCondition;
    var queryStringObject = getQueryStringAsObject();
    var viewDelay = 3000;
    var selectDelay = 5000;
    var selectionTimeStart;
    var selectionTimeEnd;
    var selectionTimoutID;
    var acceptablePageTypes = ["/home", "/category", "/product"];
    
    self.init = function(){
        pageType = window.location.pathname;
        
        //only run on the trial pages
        if (acceptablePageTypes.indexOf(pageType) === -1) {
            return;
        }
        
        changeLocation = queryStringObject["l"];
        changeCondition = queryStringObject["c"];
        
        $(document).on("click", verifyClick);
        
        
        if (queryStringObject["r"] != undefined) {
            //second page load with the change, don't set 3 second timout
            runTrial();
        } else {
console.log("Starting 3 second timer...");            
            setTimeout(runTrial, viewDelay);
        }
    };
    
    function runTrial(){
        if (changeCondition == 1) {
console.log("Change condition 1, 0.5 second blank screen");
            //blank screen for 0.5 second
            $(document.body).css("visibility", "hidden");
            
            //change element while hidden
            changeElement();
            
            setTimeout(function(){
                //show body again
                $(document.body).css("visibility", "visible");
                
                selectionTimeStart = Date.now();
                startSelectionTimer();
            }, 500);
        } else if (changeCondition == 2 || changeCondition == 3) {
            //normal HTTP request or HTTP request with latency
            //set window.location to followup page, which will have modified HTML

            if (queryStringObject["r"] != undefined) {
                //this is the request with the changed element,
                //do not refresh, otherwise we'd be in a loop
                selectionTimeStart = Date.now();
                
                startSelectionTimer();
            } else {
                //reload the page with the new HTML
                //"r" param is used to prevent this from happening a second time
                window.location = window.location + "&r=1";
            }
        } else {
            //change element client with no visual disruption
console.log("Change condition 4, instant change");
            changeElement();
            
            selectionTimeStart = Date.now();
            startSelectionTimer();
        }
    }

    function changeElement(){
        if (changeLocation == 1) {
            //logo change
            $("#location-1").attr("src", "/images/logo-brick-2.png");
        } else if (changeLocation == 2) {
            //search box change
            $("#location-2").attr("value", "Brick size, type, set...");
        } else if (changeLocation == 3) {
            //button text change
            if (pageType == "/home") {
                $("#location-3").text("View the Sales");
            } else if (pageType == "/category") {
                $("#location-3").text("Best Sellers");
            } else {
                $("#location-3").text("Put in Cart");
            }
        } else if (changeLocation == 4) {
            //change an image in one block
            if (pageType == "/home") {
                $("#location-4").attr("src", "/images/lego-bricks-various-sizes-white.png"); 
            } else if (pageType == "/category") {
                $("#location-4").attr("src", "/images/2x4-short-red.png"); 
            } else {
                $("#location-4").attr("src", "/images/2x8-tall-gray.png"); 
            }                
        } else {
            //change an image in another block
            if (pageType == "/home") {
                $("#location-5").attr("src", "/images/lego-bricks-set-2.jpeg");
            } else if (pageType == "/category") {
                $("#location-5").attr("src", "/images/1x4-tall-flipped.png");
            } else {
                $("#location-5").attr("src", "/images/1x6-short-flipped.png");                
            }                
        }        
    }
    
    function startSelectionTimer(){
        selectionTimoutID = setTimeout(failedToMakeSelection, selectDelay);
    
console.log("Selection timer set", selectionTimoutID);
    }
    
    function failedToMakeSelection(){
        clearTimeout(selectionTimoutID);

        var queryString;
        var data = gatherData();
        
        queryString = $.param(data);
        
        //send data for this trial to back-end as query string
        //window.location = "/trial?";
console.log("Failed to make a selection", queryString);
    }
    
    function verifyClick(e){
        e.preventDefault();
        var queryString;
        var data = gatherData(e);
        
        queryString = $.param(data);
        
        //send data for this trial to back-end as query string
        //window.location = "/trial?";
console.log("verifyClick", queryString);
    }
    
    function gatherData(event){
        var data = {};
        //gather position data for element that was changed
        var changedElement = $("#location-" + changeLocation);
        var changedElementOffset = changedElement.offset();
        
        data["elementX"] = changedElementOffset.left;
        data["elementY"] = changedElementOffset.top;
        data["elementWidth"] = changedElement.outerWidth();
        data["elementHeight"] = changedElement.outerHeight();
        
        //gather position data for position that was clicked
        data["clickedX"] = (event) ? event.clientX : "null";
        data["clickedY"] = (event) ? event.clientY : "null";
        
        //something was clicked, so throw away failure timer
        clearTimeout(selectionTimoutID);        
        selectionTimeEnd = Date.now();
        
        if (event && (event.target.id === "location-" + changeLocation)) {
            data["selectionStatus"] = "correct";
        } else if (event && e.target.id !== "location-" + changeLocation) {
            data["selectionStatus"] = "incorrect";
        } else {
            data["selectionStatus"] = "timeout";
        }

console.log(selectionTimeEnd, selectionTimeStart);        
        data["selectionTime"] = (selectionTimeEnd - selectionTimeStart);
        
        return data;
    }
    
    function getQueryStringAsObject(string) {
        var queryString = window.location.search;
        var queryStringAsObject = {};
        var qs;
        var temp;
        
        if (queryString.length) {
            //remove "?" from beginning
            qs = queryString.substring(1);
            
            qs = qs.split("&");
            
            for(var keyValue in qs){
                temp = qs[keyValue].split("=");
                
                queryStringAsObject[temp[0]] = temp[1];
            }
        }
        
        return queryStringAsObject;
    }
    
    return self;    
})(jQuery);

//Trial.init();