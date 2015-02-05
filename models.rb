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
  
  # Page stats
  property :page_type, String, :length => 32
  property :changed_area, String, :length => 128
  property :change_type, String, :length => 16
  
  # User stats
  property :selected_area, String, :length => 128, :default => ""
  property :selection_time, Integer
  
  # Boomerang stats
  property :page_load_time, Integer
  property :page_latency, Float
  
  belongs_to :session
end
