var Trial = (function($){
    var self = {};
    var pageType;
    var changeLocation;
    var changeCondition;
    var queryStringObject = getQueryStringAsObject();
    var viewDelay = 3000;
    var selectDelay = 5000;
    var minScreenWidth = 1024;
    var minScreenHeight = 900;
    var warningModal;
    var allowClick = false;
    var selectionTimeStart;
    var selectionTimeEnd;
    var selectionTimoutID;
    var acceptablePageTypes = ["/home", "/category", "/product"];
    
    self.pageLoadTime = 0;

    self.init = function(){
        pageType = window.location.pathname;
        
        checkScreenSize();

        checkBrowserVersion();
        
        $(window).on("resize", checkScreenSize);

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
            setTimeout(runTrial, viewDelay);
        }

        //pre-fetch images to prevent change flicker
        var images = [   
                //Trial images
                "/images/lego-bricks-set-2.jpeg",
                "/images/logo-brick-2.png",
                "/images/1x4-tall-flipped.png",
                "/images/1x6-short-flipped.png",
                "/images/2x4-short-red.png"
            ];
            
        for (var i = 0; i < images.length; i++) {
            (new Image()).src = images[i];
        }
    };
    
    function runTrial(){
        if (changeCondition == 1) {
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
        } else if (changeCondition == 2) {
            //normal HTTP request

            if (queryStringObject["r"] != undefined) {
                //this is the request with the changed element,
                //do not refresh, otherwise we'd be in a loop
                selectionTimeStart = Date.now();
                
                startSelectionTimer();
            } else {             
                //reload the page with the new HTML
                //"r" param is used to prevent this from happening a second time
                //include timestamp to prevent caching
                window.location = window.location + "&r=1&t=" + Date.now();
            }
        } else {
            //change element client with no visual disruption
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
        allowClick = true;
        
        selectionTimoutID = setTimeout(failedToMakeSelection, selectDelay);
    }
    
    function failedToMakeSelection(){
        clearTimeout(selectionTimoutID);

        var queryString;
        var data = gatherData();
        
        queryString = $.param(data);

        var href = "/trial?" + queryString;

        showNextTrialModal(href);
    }
    
    function verifyClick(e){
        if(!allowClick){
            return false;
        }

        e.preventDefault();
        var queryString;
        var data = gatherData(e);
        
        queryString = $.param(data);

        var href = "/trial?" + queryString;
        
        showNextTrialModal(href);
    }
    
    function showNextTrialModal(href){
        $(window).off("resize", checkScreenSize);
        $(document).off("click", verifyClick);

        if(currentTrial < 30){
            var modal = $('<div id="trial-complete" class="modal">\
                        <strong>Trial Complete</strong>\
                        <p>\
                            Click "Next Trial" when you\'re ready. Remember that:\
                            <ol>\
                                <li>You will be shown a web page.</li>\
                                <li>After 3 seconds, one of the elements on the page will change.</li>\
                                <li>You have 5 seconds to select the element that changed.</li>\
                                <li>Select the element that changed by clicking on it.</li>\
                                <li>If you do not select an element, the study will continue.</li>\
                            </ol>\
                        </p>\
                        <a href="' + href + '" class="button">Next Trial</a>\
                    </div>');
        } else {
            var modal = $('<div id="trial-complete" class="modal">\
                        <strong>Trial Complete</strong>\
                        <p>\
                            That completes the trials for this test. Click "Go to Questionnaire" when you\'re ready. \
                        </p>\
                        <a href="' + href + '" class="button">Go to Questionnaire</a>\
                    </div>');
        }

        $.magnificPopup.open({
              items: {
                src: modal, 
                type: 'inline'
              },
              modal: true,
              preloader: false
        });
        
        $(document).on("click", "#trial-complete .button", function(){ 
            $.magnificPopup.close(); 
        });        
    }

    function gatherData(event){
        //something was clicked, so throw away failure timer
        clearTimeout(selectionTimoutID);        
        selectionTimeEnd = Date.now();
        
        var data = {};
        
        //gather position data for element that was changed
        var changedElement = $("#location-" + changeLocation);
        var changedElementOffset = changedElement.offset();
        
        data["page_type"] = pageType;
        data["change_location"] = changeLocation;
        data["change_type"] = changeCondition;
        data["element_x"] = changedElementOffset.left;
        data["element_y"] = changedElementOffset.top;
        data["element_width"] = changedElement.outerWidth();
        data["element_height"] = changedElement.outerHeight();
        
        //gather position data for position that was clicked
        data["clicked_x"] = (event) ? event.clientX : -1;
        data["clicked_y"] = (event) ? event.clientY : -1;
        

        
        if (event && (event.target.id === "location-" + changeLocation)) {
            data["selection_status"] = "correct";
        } else if (event && event.target.id !== "location-" + changeLocation) {
            data["selection_status"] = "incorrect";
        } else {
            data["selection_status"] = "timeout";
        }
        
        if (event && event.target.id) {
            data["selected_location"] = event.target.id;
        } else {
            data["selected_location"] = -1;
        }

        data["page_load_time"] = self.pageLoadTime;
        data["selection_time"] = (selectionTimeEnd - selectionTimeStart);
        
        return data;
    }
    
    function checkScreenSize(args) {
        var modal = $('<div id="screen-size-warning" class="modal"></div>')
              .text('The size of your browser is too small for this study. \
                    Please adjust your browser size to at least ' + minScreenWidth + ' pixels wide by ' + minScreenHeight + ' pixels high to continue.');

        if (window.outerWidth < minScreenWidth || window.outerHeight < minScreenHeight) {
            allowClick = false;
            $.magnificPopup.open({
              items: {
                src: modal, 
                type: 'inline'
              },
              modal: true,
              preloader: false
            });
        } else {
            allowClick = true;

            $.magnificPopup.close();
        }
    }
    
    function checkBrowserVersion(){
        if($('html').is('.ie6, .ie7, .ie8')){
            $("#begin-test, .loader").remove();

            var modal = $('<div id="browser-version-warning" class="modal"></div>')
              .text('Sorry, but only Internet Explorer versions 9 and up are supported in this study. \
                    Please upgrade your version of Internet Explorer or try a different browser.');

            $.magnificPopup.open({
              items: {
                src: modal, 
                type: 'inline'
              },
              modal: true,
              preloader: false
            });
        };
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