class Session
  include DataMapper::Resource

  # User data
  property :id, Serial  
  property :session_id, String, :length => 256
  property :progress, Float, :default => 0.0
  property :current_trial, Integer, :default => 0
  property :created_at, DateTime
  property :has_given_consent, Boolean, :default => false
  property :mechanical_turk_code, String, :length => 128
  
  # Browser data
  property :ip_address, String, :length => 16
  property :screen_width, Integer
  property :screen_height, Integer
  property :browser_width, Integer
  property :browser_height, Integer
  property :pixel_depth, Integer
  property :platform, String, :length => 64
  property :language, String, :length => 32
  property :browser, String, :length => 64
  property :user_agent, String, :length => 192
  property :bandwidth, Integer
  
  has n, :trial
end

class Trial 
  include DataMapper::Resource
  
  property :id, Serial
  property :created_at, DateTime
  property :trial_number, Integer, :default => 1
  
  # Page stats
  property :page_type, String, :length => 32
  property :change_location, String, :length => 32
  property :change_type, String, :length => 32
  property :element_x, Float
  property :element_y, Float
  property :element_width, Integer
  property :element_height, Integer

  # User stats
  property :selected_location, String, :length => 128
  property :selection_time, Integer
  property :selection_status, String, :length => 16
  property :clicked_x, Float
  property :clicked_y, Float
  
  # Boomerang stats
  property :page_load_time, Integer
  property :page_latency, Integer
  
  belongs_to :session
end
