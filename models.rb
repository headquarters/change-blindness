class Session
  include DataMapper::Resource

  # User data
  property :id, Serial  
  property :session_id, String, :length => 256
  property :progress, Float, :default => 0.0
  property :current_question, Integer
  property :created_at, DateTime
  property :has_given_consent, Boolean, :default => false
  property :mechanical_turk_code, String, :length => 128
  property :ip_address, String, :length => 16
  
  # Browser data
  property :screen_width, Integer
  property :screen_height, Integer
  property :browser_width, Integer
  property :browser_height, Integer
  property :pixel_depth, Integer
  property :platform, String, :length => 64
  property :language, String, :length => 32
  property :browser, String, :length => 64
  property :user_agent, String, :length => 192
  
  has n, :trial
end

class Trial 
  include DataMapper::Resource
  
  property :id, Serial
  property :created_at, DateTime
  
  property :page_name, String, :length => 32
  property :changed_area, String, :length => 128
  property :selected_area, String, :length => 128, :default => ""
  
  belongs_to :session
end
=begin
class InputType
  include DataMapper::Resource
  
  property :id, Serial
  property :input_type_name, String
  
  has n, :question
end


class Category
  include DataMapper::Resource
  
  property :id, Serial
  property :category_name, String
  property :category_identifier, String
  
  has n, :question
end

class RiskLevel
  include DataMapper::Resource
  
  property :id, Serial
  property :risk_level_name, String
  property :risk_level_identifier, String
  
  has 1, :risk_message  
  has n, :question_option
end

class RiskMessage
  include DataMapper::Resource
  
  property :id, Serial
  property :message, Text
  property :group_id, Integer
  
  belongs_to :risk_level
  #has n, :question_option
end

class OptionChoice
  include DataMapper::Resource
  
  property :id, Serial
  property :option_choice_name, String, :length => 128
  property :option_choice_value, Float, :required => false
  
  has n, :question_option
end

class QuestionOption
  include DataMapper::Resource
  
  property :id, Serial
  
  has n, :answer
  belongs_to :question
  belongs_to :option_choice
  belongs_to :risk_level
  belongs_to :risk_message, :required => false
end

class Question
  include DataMapper::Resource
  
  property :id, Serial
  property :question_name, String, :length => 128
  property :question_topic_name, String, :length => 128
  property :question_topic_message, Text
  property :group_id, Integer

  has n, :answer
  belongs_to :input_type
  belongs_to :category
end

class Answer
  include DataMapper::Resource
  
  property :id, Serial
  property :group_id, Integer
  
  belongs_to :session
  belongs_to :question_option
  belongs_to :question
  
  property :created_at, DateTime
end

class Resource
  include DataMapper::Resource
  
  property :id, Serial
  property :text, Text
  property :group_id, Integer
end
=end