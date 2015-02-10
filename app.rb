require "rubygems"
require "bundler/setup"
require "sinatra"
require "data_mapper"
require "json"
require "securerandom"

enable :sessions

set :session_secret, ENV["CHANGE_BLINDNESS_SESSION_SECRET"]
set :sessions, :expire_after => 2592000

set :bind, "0.0.0.0"

configure :production do
  # Do not serve static assets with sinatra in production
  set :static, false
  
  db_user = ENV["OPENSHIFT_POSTGRESQL_DB_USERNAME"]
  db_password = ENV["OPENSHIFT_POSTGRESQL_DB_PASSWORD"]
  db_host = ENV["OPENSHIFT_POSTGRESQL_DB_HOST"]
  db_port = ENV["OPENSHIFT_POSTGRESQL_DB_PORT"]
  db_name = ENV["OPENSHIFT_GEAR_NAME"]
  DataMapper.setup(:default, "postgresql://#{db_user}:#{db_password}@#{db_host}:#{db_port}/#{db_name}")
end

configure :development do
  # max_age is in seconds 
  set :static_cache_control, [:public, :max_age => 3600]

  DataMapper.setup(:default, "sqlite:cb.db")
  
  DataMapper::Logger.new($stdout, :debug)
end

require "./models"

DataMapper.auto_upgrade! 
DataMapper.finalize

Trial.raise_on_save_failure = true 

# Full <title> passed to a view by being global
@@page_title = ""

TOTAL_TRIALS = 30

# Use round() when displaying.
INCREMENT = 100.0/TOTAL_TRIALS

conditions_pool = [
  # Condition 1: Blank screen for 0.5 second, change element while hidden, then show again
  "blank-screen",
  "blank-screen",  
  "blank-screen",  
  "blank-screen",  
  "blank-screen",  
  "blank-screen",  
  "blank-screen",  
  "blank-screen",  
  "blank-screen",  
  "blank-screen",  
  # Condition 2: Normal HTTP request; second page contains changed item
  "normal-http",
  "normal-http",
  "normal-http",
  "normal-http",
  "normal-http",
  "normal-http",
  "normal-http",
  "normal-http",
  "normal-http",
  "normal-http",  
  # Condition 3: Change element on the client
  "no-http",
  "no-http",
  "no-http",
  "no-http",
  "no-http",
  "no-http",
  "no-http",
  "no-http",
  "no-http",
  "no-http",  
]

# URL structure:
# /<template_name>/<location_of_change>/<condition_of_change>
# Template name: either home, category, or product template is loaded
# Location of change: DOM element ID that will change
# Condition of change: 1 of 4 possible conditions (randomly applied at time of request)
trials_pool = [
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
  session[:trials] = trials_pool
  session[:conditions] = conditions_pool
  erb :start_test, :layout => :practice_layout
end

# Condition 1: Blank screen for 0.5 second, change element while hidden, then show again
# Condition 2: Normal HTTP request; second page contains changed item
# Condition 3: Change element on the client
# Each of the three page templates can change in one of 5 ways.
# Each trial consists of seeing one of the three pages (home, category, or product),
# where one of the conditional changes happens. 
get "/trial" do
  if session[:trials].nil?
    session[:trials] = trials_pool
  end

  if session[:conditions].nil?
    session[:conditions] = conditions_pool
  end

  if !params.empty?
    # Collect data from previous trial before redirecting to the next one
#puts "*******************"
#puts params.inspect
#puts "*******************"

    trial = Trial.create(
      :session_id => @session.id,
      :trial_number => @session.current_trial,
      :page_type => params[:page_type],
      :change_location => params[:change_location],
      :change_type => params[:change_type],
      :element_x => params[:element_x],
      :element_y => params[:element_y],
      :element_width => params[:element_width],
      :element_height => params[:element_height],
      :selected_location => params[:selected_location],
      :selection_time => params[:selection_time],
      :selection_status => params[:selection_status],
      :clicked_x => params[:clicked_x],
      :clicked_y => params[:clicked_y],
      :page_load_time => params[:page_load_time],
      :page_latency => params[:page_latency]
    )
    
#puts "#####################"
#puts trial.saved?
#puts "#####################"
    @session.current_trial = @session.current_trial + 1
    @session.save
  end
  
  current_trial = @session.current_trial

puts ">>>>>>>>>>>>>>>>>>>>>>>>>>"
puts session[:trials].inspect
puts session[:trials].size
puts session[:conditions].inspect
puts session[:conditions].size
puts current_trial
#puts ">>>>>>>>>>>>>>>>>>>>>>>>>>"
  if current_trial > 30
    # Go to results
    redirect "/results"
  else 
    trials = session[:trials]
    random_trial = trials.shuffle!.shift
  
    conditions = session[:conditions]
    condition = conditions.shuffle!.shift

    if condition == "blank-screen"
      random_trial += "&c=1"
    elsif condition == "normal-http"
      random_trial += "&c=2"
    else
      random_trial += "&c=3"
    end
    
    redirect random_trial.to_sym
  end
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
  if !session[:trials].empty? || @session.current_trial < 30
    redirect "/trial"
  end
  
  if @session.mechanical_turk_code
    @mechanical_turk_code = @session.mechanical_turk_code
  else
    @mechanical_turk_code = SecureRandom.hex(5)
    
    @session.mechanical_turk_code = @mechanical_turk_code
    @session.save
  end
  
  erb :results, :layout => :practice_layout
end

get "/beacon" do
  # TODO: Use http://ipinfo.io/ to get location from IP later
  @session.ip_address = request.ip
  @session.screen_width = params[:screen_width]
  @session.screen_height = params[:screen_height]
  @session.browser_width = params[:browser_width]
  @session.browser_height = params[:browser_height]
  @session.pixel_depth = params[:pixel_depth]
  @session.platform = params[:platform]
  @session.language = params[:language]
  @session.browser = params[:browser]
  @session.user_agent = params[:user_agent]
  @session.bandwidth = params[:bw]
  
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