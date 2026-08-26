#!/usr/bin/env ruby

require 'xcodeproj'

project_root = File.expand_path('..', __dir__)
project_path = File.join(project_root, 'ios', 'App', 'App.xcodeproj')
project = Xcodeproj::Project.open(project_path)

products = {
  'Graceward' => {
    build_version: '38',
    marketing_version: '1.0',
    bundle_id: 'com.darrylgraham.graceward',
    widget_bundle_id: 'com.darrylgraham.graceward.GracewardWidget',
    display_name: 'Graceward',
    url_scheme: 'graceward',
    app_entitlements: 'App/App.entitlements',
    widget_entitlements: '../CosmiqWidget/CosmiqWidget.entitlements',
    app_icon: 'AppIconGraceward',
    launch_storyboard: 'LaunchScreenGraceward',
    swift_condition: 'GRACEWARD_PRODUCT'
  },
  'Cosmiq' => {
    build_version: '349',
    marketing_version: '4.8',
    bundle_id: 'com.darrylgraham.revolution',
    widget_bundle_id: 'com.darrylgraham.revolution.CosmiqWidget',
    display_name: 'Cosmiq',
    url_scheme: 'cosmiq',
    app_entitlements: 'App/Cosmiq.entitlements',
    widget_entitlements: '../CosmiqWidget/CosmiqProduct.entitlements',
    app_icon: 'AppIconCosmiq',
    launch_storyboard: 'LaunchScreenCosmiq',
    swift_condition: 'COSMIQ_PRODUCT'
  }
}.freeze

def deep_copy(value)
  Marshal.load(Marshal.dump(value))
end

def prepare_configuration(owner, product_name, variant)
  target_name = "#{product_name}#{variant}"
  existing = owner.build_configurations.find { |configuration| configuration.name == target_name }
  return existing if existing

  legacy_name = variant
  legacy = owner.build_configurations.find { |configuration| configuration.name == legacy_name }
  if product_name == 'Graceward' && legacy
    legacy.name = target_name
    return legacy
  end

  source = owner.build_configurations.find { |configuration| configuration.name == "Graceward#{variant}" }
  raise "Missing Graceward#{variant} configuration for #{owner}" unless source

  configuration = owner.add_build_configuration(target_name, variant == 'Debug' ? :debug : :release)
  configuration.build_settings = deep_copy(source.build_settings)
  configuration.base_configuration_reference = source.base_configuration_reference
  configuration
end

%w[Debug Release].each do |variant|
  prepare_configuration(project, 'Graceward', variant)
  prepare_configuration(project, 'Cosmiq', variant)
end
project.build_configuration_list.default_configuration_name = 'GracewardRelease'

app_target = project.targets.find { |target| target.name == 'App' }
widget_target = project.targets.find { |target| target.name == 'CosmiqWidgetExtension' }
raise 'Missing App target' unless app_target
raise 'Missing CosmiqWidgetExtension target' unless widget_target

[app_target, widget_target].each do |target|
  %w[Debug Release].each do |variant|
    prepare_configuration(target, 'Graceward', variant)
    prepare_configuration(target, 'Cosmiq', variant)
  end
  target.build_configuration_list.default_configuration_name = 'GracewardRelease'
end

products.each do |product_name, product|
  %w[Debug Release].each do |variant|
    config_name = "#{product_name}#{variant}"
    app_config = app_target.build_configurations.find { |configuration| configuration.name == config_name }
    widget_config = widget_target.build_configurations.find { |configuration| configuration.name == config_name }

    app_config.build_settings.merge!({
      'ASSETCATALOG_COMPILER_APPICON_NAME' => product[:app_icon],
      'CODE_SIGN_ENTITLEMENTS' => product[:app_entitlements],
      'CURRENT_PROJECT_VERSION' => product[:build_version],
      'INFOPLIST_FILE' => 'App/Info.plist',
      'INFOPLIST_KEY_CFBundleDisplayName' => product[:display_name],
      'MARKETING_VERSION' => product[:marketing_version],
      'PRODUCT_BRAND' => product_name.downcase,
      'PRODUCT_BUNDLE_IDENTIFIER' => product[:bundle_id],
      'PRODUCT_DISPLAY_NAME' => product[:display_name],
      'PRODUCT_LAUNCH_STORYBOARD' => product[:launch_storyboard],
      'PRODUCT_URL_SCHEME' => product[:url_scheme],
      'SWIFT_ACTIVE_COMPILATION_CONDITIONS' => "$(inherited) #{variant == 'Debug' ? 'DEBUG ' : ''}#{product[:swift_condition]}"
    })

    widget_config.build_settings.merge!({
      'CODE_SIGN_ENTITLEMENTS' => product[:widget_entitlements],
      'CURRENT_PROJECT_VERSION' => product[:build_version],
      'GENERATE_INFOPLIST_FILE' => 'NO',
      'INFOPLIST_FILE' => '../CosmiqWidget/Info.plist',
      'INFOPLIST_KEY_CFBundleDisplayName' => product[:display_name],
      'MARKETING_VERSION' => product[:marketing_version],
      'PRODUCT_BRAND' => product_name.downcase,
      'PRODUCT_BUNDLE_IDENTIFIER' => product[:widget_bundle_id],
      'PRODUCT_DISPLAY_NAME' => product[:display_name],
      'SWIFT_ACTIVE_COMPILATION_CONDITIONS' => "$(inherited) #{variant == 'Debug' ? 'DEBUG ' : ''}#{product[:swift_condition]}"
    })
  end
end

app_group = project.main_group.groups.find { |group| group.display_name == 'App' }
widget_group = project.main_group.groups.find { |group| group.display_name == 'CosmiqWidget' }
raise 'Missing App project group' unless app_group
raise 'Missing CosmiqWidget project group' unless widget_group

app_files = [
  'Cosmiq.entitlements',
  'CosmiqProducts.storekit',
  'LaunchScreenCosmiq.storyboard',
  'LaunchScreenGraceward.storyboard'
]
app_files.each do |file_name|
  app_group.new_file(file_name) unless app_group.files.any? { |file| file.path == file_name }
end
widget_group.new_file('CosmiqProduct.entitlements') unless widget_group.files.any? do |file|
  file.path == 'CosmiqProduct.entitlements'
end

resource_paths = ['LaunchScreenCosmiq.storyboard', 'LaunchScreenGraceward.storyboard']
resource_paths.each do |file_name|
  file_reference = app_group.files.find { |file| file.path == file_name }
  unless app_target.resources_build_phase.files_references.include?(file_reference)
    app_target.resources_build_phase.add_file_reference(file_reference)
  end
end

verification_phase = app_target.shell_script_build_phases.find do |phase|
  phase.name == 'Verify Bundled Web Assets'
end
raise 'Missing Verify Bundled Web Assets build phase' unless verification_phase
verification_phase.shell_script = <<~'SCRIPT'
  PROJECT_ROOT="${SRCROOT}/../.."
  NODE_EXECUTABLE="$(${PROJECT_ROOT}/scripts/find-node-for-xcode.sh "${PROJECT_ROOT}")"
  "${NODE_EXECUTABLE}" "${PROJECT_ROOT}/scripts/verify-ios-web-assets.mjs" --product "${PRODUCT_BRAND}" --target-built-assets "${TARGET_BUILD_DIR}/${CONTENTS_FOLDER_PATH}/public/assets" --skip-generated-build-scan
SCRIPT

project.save
puts '[ios:schemes] Configured isolated Cosmiq and Graceward Xcode build configurations.'
