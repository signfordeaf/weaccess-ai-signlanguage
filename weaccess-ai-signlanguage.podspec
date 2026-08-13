require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "weaccess-ai-signlanguage"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => "13.0" }
  s.source       = { :git => "https://github.com/signfordeaf/weaccess-ai-signlanguage.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.swift_version = "5.0"

  # The SDK plays video itself rather than depending on `react-native-video`, so
  # that integrators install one package. Both are system frameworks, so this
  # costs nothing in binary size.
  s.frameworks = "AVFoundation", "CoreMedia"

  # Let React Native decide what this pod needs.
  #
  # This used to be a hand-rolled `if ENV['RCT_NEW_ARCH_ENABLED'] == '1'` block
  # that depended on `React-Codegen`. Two things made that a latent break: the
  # pod was renamed to `ReactCodegen` in React Native 0.75, and from 0.82
  # `use_react_native!` sets `RCT_NEW_ARCH_ENABLED=1` unconditionally — so the
  # block always fires and always asks for a pod that no longer exists. A clean
  # `pod install` on a current React Native would fail.
  #
  # `install_modules_dependencies` is React Native's own helper for exactly
  # this, and it tracks the renames for us.
  if respond_to?(:install_modules_dependencies, true)
    install_modules_dependencies(s)
  else
    s.dependency "React-Core"
  end
end
