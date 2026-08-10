Pod::Spec.new do |s|
  s.name           = 'MurmurAudio'
  s.version        = '1.2.0'
  s.summary        = 'Native audio capture for Murmur live translation'
  s.description    = 'Captures microphone audio for Murmur through an Expo local module.'
  s.author         = 'Q9Labs'
  s.homepage       = 'https://github.com/Q9Labs/murmur'
  s.platforms      = {
    :ios => '15.1',
    :tvos => '15.1'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
