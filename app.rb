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

# Part of the <title> that will not change, gets appended to other strings in views
ORGANIZATION = "Brick Mart"
# Full <title> passed to a view by being global
@@page_title = "Page Title"

TOTAL_TRIALS = 30

# Use round() when displaying.
INCREMENT = 100.0/TOTAL_TRIALS

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
  erb :home, :layout => :home_layout
end

post "/consent" do
  @session.has_given_consent = true
  @session.save
  
  redirect "/practice"
end

get "/practice" do
  @@page_title = "Practice"
  erb :practice, :layout => :home_layout  
end

get "/start-test" do
  erb :start_test, :layout => :home_layout
end

# Condition 1: Blank screen for 0.5 second, change element while hidden, then show again
# Condition 2: Normal HTTP request; second page contains changed item
# Condition 3: Normal HTTP request with increased latency; second page contains changed item
# Condition 4: Change element on the client
# Each of the three page templates can change in one of 5 ways.
# Each trial consists of seeing one of the three pages (home, category, or product),
# where one of the conditional changes happens. 
get "/trial" do
  puts "here"
end

get "/results" do
  # if not at 100% complete, redirect to another trial
  
  # generate a mechanical turk code
  
end

## Trial pages
# Home page
get "/home" do
  @@page_title = "Home | " + ORGANIZATION
  @active = "home"
  erb :home_page
end

# Category page
get "/category" do
  @@page_title = "Categories | " + ORGANIZATION
  @active = "categories"
  erb :category_page 
end

# Product page
get "/product" do
  @@page_title = "Lego Brick 39479 | " + ORGANIZATION
  @active = "product"
  erb :product_page
end

get "/beacon" do
  puts request.params["ba"]
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