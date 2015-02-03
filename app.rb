require "rubygems"
require "sinatra"
require "data_mapper"
require "json"

# Require the session file that contains the session secret and expiry time
require "./session"

set :bind, "0.0.0.0"

configure :development do
  DataMapper::Logger.new($stdout, :debug)
end

DataMapper.setup(:default, "sqlite:cb.db")

require "./models"

DataMapper.auto_upgrade! 
DataMapper.finalize

# Full <title> passed to a view by being global
@@page_title = ""

TOTAL_TRIALS = 30

# Use round() when displaying.
INCREMENT = 100.0/TOTAL_TRIALS

conditions = [
  # Condition 1: Blank screen for 0.5 second, change element while hidden, then show again
  "blank-screen",  
  # Condition 2: Normal HTTP request; second page contains changed item
  "normal-http",
  # Condition 3: Normal HTTP request with increased latency; second page contains changed item
  "slow-http",
  # Condition 4: Change element on the client
  "no-http"
]

# URL structure:
# /<template_name>/<location_of_change>/<condition_of_change>
# Template name: whether home, category, or product template is loaded
# Location of change: DOM element ID that will change
# Condition of change: 1 of 4 possible conditions (randomly applied at time of request)
# TODO: this will need to persist for the entire session
trials = [
  "/home?l=1",
  "/home?l=1",
  "/home?l=2",
  "/home?l=2",
  "/home?l=3",
  "/home?l=3",
  "/home?l=4",
  "/home?l=4",
  "/home?l=5",
  "/home?l=5",
  "/category?l=1",
  "/category?l=1",
  "/category?l=2",
  "/category?l=2",
  "/category?l=3",
  "/category?l=3",
  "/category?l=4",
  "/category?l=4",
  "/category?l=5",
  "/category?l=5",
  "/product?l=1",
  "/product?l=1",
  "/product?l=2",
  "/product?l=2",
  "/product?l=3",
  "/product?l=3",
  "/product?l=4",
  "/product?l=4",
  "/product?l=5",
  "/product?l=5",
]

before do
  # Get the first session with this session_id or just create it and return that session row
  @session = Session.first_or_create(:session_id => session.id)
  
  # If no consent given, return to home page
  #if request.path != "/" && !@session.has_given_consent
  #  redirect "/"
  #end
end

## Study pages
get "/" do
  @@page_title = "Change Blindness Study"
  #print @session.inspect
  erb :home, :layout => :practice_layout
end

post "/consent" do
  @session.has_given_consent = true
  @session.save
  
  redirect "/practice"
end

get "/practice" do
  @@page_title = "Practice"
  erb :practice, :layout => :practice_layout  
end

get "/start-test" do
  # Store the full array of trials here, for randomly picking during each /trial request
  session[:trials] = trials
  erb :start_test, :layout => :practice_layout
end

# Condition 1: Blank screen for 0.5 second, change element while hidden, then show again
# Condition 2: Normal HTTP request; second page contains changed item
# Condition 3: Normal HTTP request with increased latency; second page contains changed item
# Condition 4: Change element on the client
# Each of the three page templates can change in one of 5 ways.
# Each trial consists of seeing one of the three pages (home, category, or product),
# where one of the conditional changes happens. 
get "/trial" do
  if session[:trials].nil?
    session[:trials] = trials
  end
  
  trials = session[:trials]
  random_trial = trials.shuffle!.shift

  condition = conditions.sample
  
  if condition == "blank-screen"
    random_trial += "&c=1"
  elsif condition == "normal-http"
    random_trial += "&c=2"
  elsif condition == "slow-http"
    random_trial += "&c=3"
  else
    random_trial += "&c=4"
  end
  
  current_trial = @session.current_trial
  @session.current_trial = current_trial + 1
  @session.save
  
  redirect random_trial.to_sym
end

# TODO: what to do about refreshing the page?
## Trial pages
# Home page
get "/home" do
  @@page_title = "Trial #{@session.current_trial}"
  

  erb :home_page
end

# Category page
get "/category" do
  @@page_title = "Trial #{@session.current_trial}"

  erb :category_page 
end

# Product page
get "/product" do
  @@page_title = "Trial #{@session.current_trial}"

  erb :product_page
end

get "/results" do
  # if not at 100% complete, redirect to another trial
  
  # generate a mechanical turk code
  
end

get "/beacon" do
  # TODO: Use http://ipinfo.io/ to get location from IP later
  # IP address
  # Bandwidth
  # Latency
  # Page load time
  params.to_s
end

post "/browser-info" do
  params.each do |key, value|
    @session[key] = value
  end
  
  @session.save
end

helpers do
  def prevent_widows(text)
    if text.kind_of? String
      trimmed_text = text.rstrip
      last_space_index = trimmed_text.rindex(" ")
      
      if !last_space_index.nil?
        text[last_space_index] = "&nbsp;"
      end
    end

    return text
  end
end