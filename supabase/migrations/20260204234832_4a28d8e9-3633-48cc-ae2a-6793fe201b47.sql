-- Update "Lead Magnet Downloads" template to "Email Capture" with more inclusive description
UPDATE public.campaign_templates
SET 
  name = 'Email Capture',
  description = 'Grow your email list with a lead magnet, webinar, challenge, or free resource.',
  long_description = 'Use this when you want to grow your list using a lead magnet, webinar, challenge, quiz, or any free resource that captures email and name.',
  use_case = 'Lead magnets, webinars, challenges, free trainings, quizzes'
WHERE slug = 'lead-magnet';