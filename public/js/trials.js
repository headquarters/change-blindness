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
    
    self.init = function(){
        pageType = window.location.pathname;
        changeLocation = queryStringObject["l"];
        changeCondition = queryStringObject["c"];
        
        $(document).on("click", verifyClick);
        
        
        //start the 3 second timer
console.log("Starting 3 second timer...");        
        setTimeout(runTrial, viewDelay);
        
//console.log(pageType, changeLocation, changeCondition);
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
                
                startSelectionTimer();
            }, 500);
        } else if (changeCondition == 2 || changeCondition == 3) {
            //normal HTTP request or HTTP request with latency
            //set window.location to followup page, which will have modified HTML
console.log(queryStringObject["r"]);
            if (queryStringObject["r"] != undefined) {
                //this is the request with the changed element,
                //do not refresh, otherwise we'd be in a loop
                selectionTimeStart = Date.now();
            } else {
                //reload the page with the new HTML
                //"r" param is used to prevent this from happening a second time
                //"t" param is current timestamp for tracking page load time
                window.location = window.location + "&r=1&t=" + Date.now();
            }
        } else {
            //change element client with no visual disruption
console.log("Change condition 4, instant change");
            changeElement();
            
            startSelectionTimer();
        }
    }

    function changeElement(){
        if (changeLocation == 1) {
            //logo change
        } else if (changeLocation == 2) {
            //search box change
            $("#location-2 input").attr("value", "Brick size, type, set...");
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
            //change an entire block
            if (pageType == "/home") {
                
            } else if (pageType == "/category") {
                
            } else {
                
            }                
        } else {
            //change an image in one block
            if (pageType == "/home") {
                
            } else if (pageType == "/category") {
                
            } else {
                
            }                
        }        
    }
    
    function startSelectionTimer(){
        selectionTimoutID = setTimeout(failedToMakeSelection, selectDelay);
    
console.log("Selection timer set", selectionTimoutID);
    }
    
    function failedToMakeSelection(){
        clearTimeout(selectionTimoutID);
        selectionTimeEnd = Date.now();
console.log("Failed to make a selection; timeout cleared", selectionTimoutID);        
    }
    
    function verifyClick(e){
        var elapsedSelectionTime;
        var selectionStatus;
        
        e.preventDefault();
        
        //something was clicked, so throw away failure timer
        clearTimeout(selectionTimoutID);
        
        selectionTimeEnd = Date.now();
console.log("Selection timer cleared", selectionTimoutID);
        
        if (e.target.id == "location-" + changeLocation) {
            selectionStatus = "correct";
        } else {
            selectionStatus = "incorrect";
        }
        
        elapsedSelectionTime = (selectionTimeEnd - selectionTimeStart);
        
        
console.log(e.target, e.target.id, (selectionTimeEnd - selectionTimeStart));
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

Trial.init();