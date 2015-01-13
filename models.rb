class Session
  include DataMapper::Resource

  property :id, Serial  
  property :session_id, String, :length => 256
  property :progress, Float, :default => 0.0
  property :current_question, Integer
  property :created_at, DateTime
  
  #has n, :answer
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