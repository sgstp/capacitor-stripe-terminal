
  Pod::Spec.new do |s|
    s.name = 'CapacitorStripeTerminal'
    s.version = '3.0.0'
    s.summary = 'Capacitor plugin for Stripe Terminal (credit card readers).'
    s.license = 'MIT'
    s.homepage = 'https://github.com/zolfariot/capacitor-stripe-terminal'
    s.author = 'Lorenzo Zolfanelli <dev@zolfa.nl>'
    s.source = { :git => 'https://github.com/zolfariot/capacitor-stripe-terminal', :tag => s.version.to_s }
    s.source_files = 'ios/Plugin/**/*.{swift,h,m,c,cc,mm,cpp}'
    s.ios.deployment_target  = '13.0'
    s.dependency 'Capacitor'
    s.dependency 'StripeTerminal', '~> 3.0'
  end
