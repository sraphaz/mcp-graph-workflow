// ── Template Types ────────────────────────────────────────────────────

export interface PluginTemplate {
  pluginType: string;
  sdk: "pingfederate" | "pingaccess";
  interfaceName: string;
  descriptorClass: string;
  imports: string[];
  constructorPattern: string;
  configurePattern: string;
  mainMethodSignature: string;
  mainMethodBody: string;
  pfInfType: string;
}

export interface TemplateContext {
  className: string;
  packageName: string;
  pluginName: string;
  guiFields: string;
  configureBody: string;
  mainMethodBody: string;
  attributeContract: string[];
}

// ── Template Registry ─────────────────────────────────────────────────

const PF_TEMPLATES: Record<string, PluginTemplate> = {
  "idp-adapter": {
    pluginType: "idp-adapter",
    sdk: "pingfederate",
    interfaceName: "IdpAuthenticationAdapterV2",
    descriptorClass: "IdpAuthnAdapterDescriptor",
    imports: [
      "com.pingidentity.sdk.IdpAuthenticationAdapterV2",
      "com.pingidentity.sdk.AuthnAdapterResponse",
      "com.pingidentity.sdk.AuthnAdapterResponse.AUTHN_STATUS",
      "org.sourceid.saml20.adapter.conf.Configuration",
      "org.sourceid.saml20.adapter.gui.AdapterConfigurationGuiDescriptor",
      "org.sourceid.saml20.adapter.gui.TextFieldDescriptor",
      "org.sourceid.saml20.adapter.idp.authn.IdpAuthnAdapterDescriptor",
      "javax.servlet.http.HttpServletRequest",
      "javax.servlet.http.HttpServletResponse",
      "java.util.Map",
      "java.util.Set",
      "java.util.HashSet",
    ],
    constructorPattern: "IdpAuthnAdapterDescriptor",
    configurePattern: "configuration.getFieldValue",
    mainMethodSignature: "public AuthnAdapterResponse lookupAuthN(HttpServletRequest req, HttpServletResponse resp, Map<String, Object> inMap)",
    mainMethodBody: "// DaVinci logic translated here",
    pfInfType: "idp-authn-adapters",
  },
  "token-generator": {
    pluginType: "token-generator",
    sdk: "pingfederate",
    interfaceName: "TokenGenerator",
    descriptorClass: "TokenPluginDescriptor",
    imports: [
      "org.sourceid.wstrust.plugin.generate.TokenGenerator",
      "org.sourceid.wstrust.plugin.generate.TokenContext",
      "org.sourceid.wstrust.model.BinarySecurityToken",
      "org.sourceid.wstrust.plugin.TokenProcessingException",
      "com.pingidentity.sdk.PluginDescriptor",
      "com.pingidentity.sdk.GuiConfigDescriptor",
      "org.sourceid.saml20.adapter.gui.TextFieldDescriptor",
      "org.sourceid.saml20.adapter.conf.Configuration",
      "java.util.Collections",
      "java.util.Set",
    ],
    constructorPattern: "TokenPluginDescriptor",
    configurePattern: "configuration.getFieldValue",
    mainMethodSignature: "public BinarySecurityToken generateToken(TokenContext attributeContext) throws TokenProcessingException",
    mainMethodBody: "// DaVinci logic translated here",
    pfInfType: "token-generators",
  },
  "token-processor": {
    pluginType: "token-processor",
    sdk: "pingfederate",
    interfaceName: "TokenProcessor<BinarySecurityToken>",
    descriptorClass: "TokenProcessorDescriptor",
    imports: [
      "org.sourceid.wstrust.plugin.process.TokenProcessor",
      "org.sourceid.wstrust.plugin.process.TokenContext",
      "org.sourceid.wstrust.plugin.process.InvalidTokenException",
      "org.sourceid.wstrust.plugin.process.TokenProcessorDescriptor",
      "org.sourceid.wstrust.model.BinarySecurityToken",
      "org.sourceid.wstrust.plugin.TokenProcessingException",
      "com.pingidentity.sdk.GuiConfigDescriptor",
      "org.sourceid.saml20.adapter.gui.TextFieldDescriptor",
      "org.sourceid.saml20.adapter.conf.Configuration",
      "java.util.Collections",
      "java.util.Set",
    ],
    constructorPattern: "TokenProcessorDescriptor",
    configurePattern: "configuration.getFieldValue",
    mainMethodSignature: "public TokenContext processToken(BinarySecurityToken token) throws InvalidTokenException, TokenProcessingException",
    mainMethodBody: "// DaVinci logic translated here",
    pfInfType: "token-processors",
  },
  "notification-publisher": {
    pluginType: "notification-publisher",
    sdk: "pingfederate",
    interfaceName: "NotificationPublisherPlugin",
    descriptorClass: "NotificationSenderPluginDescriptor",
    imports: [
      "com.pingidentity.sdk.notification.NotificationPublisherPlugin",
      "com.pingidentity.sdk.notification.NotificationSenderPluginDescriptor",
      "com.pingidentity.sdk.notification.PublishResult",
      "com.pingidentity.sdk.GuiConfigDescriptor",
      "org.sourceid.saml20.adapter.gui.TextFieldDescriptor",
      "org.sourceid.saml20.adapter.conf.Configuration",
      "java.util.Map",
    ],
    constructorPattern: "NotificationSenderPluginDescriptor",
    configurePattern: "configuration.getFieldValue",
    mainMethodSignature: "public PublishResult publishNotification(String eventType, Map<String, String> data, Map<String, String> configMap)",
    mainMethodBody: "// DaVinci logic translated here",
    pfInfType: "notification-publishers",
  },
  "secret-manager": {
    pluginType: "secret-manager",
    sdk: "pingfederate",
    interfaceName: "SecretManager",
    descriptorClass: "SecretManagerDescriptor",
    imports: [
      "com.pingidentity.sdk.secretmanager.SecretManager",
      "com.pingidentity.sdk.secretmanager.SecretManagerDescriptor",
      "com.pingidentity.sdk.secretmanager.SecretInfo",
      "com.pingidentity.sdk.secretmanager.SecretManagerException",
      "com.pingidentity.sdk.GuiConfigDescriptor",
      "org.sourceid.saml20.adapter.conf.Configuration",
      "java.util.Map",
    ],
    constructorPattern: "SecretManagerDescriptor",
    configurePattern: "configuration.getFieldValue",
    mainMethodSignature: "public SecretInfo getSecretInfo(String secretId, Map<String, Object> inParameters) throws SecretManagerException",
    mainMethodBody: "// DaVinci logic translated here",
    pfInfType: "secret-managers",
  },
  "password-credential-validator": {
    pluginType: "password-credential-validator",
    sdk: "pingfederate",
    interfaceName: "PasswordCredentialValidator",
    descriptorClass: "PluginDescriptor",
    imports: [
      "com.pingidentity.sdk.password.PasswordCredentialValidator",
      "com.pingidentity.sdk.password.PasswordValidationException",
      "com.pingidentity.sdk.GuiConfigDescriptor",
      "com.pingidentity.sdk.PluginDescriptor",
      "org.sourceid.saml20.adapter.gui.TextFieldDescriptor",
      "org.sourceid.saml20.adapter.conf.Configuration",
      "org.sourceid.util.log.AttributeMap",
    ],
    constructorPattern: "PluginDescriptor",
    configurePattern: "configuration.getFieldValue",
    mainMethodSignature: "public AttributeMap processPasswordCredential(String username, String password) throws PasswordValidationException",
    mainMethodBody: "// DaVinci logic translated here",
    pfInfType: "password-credential-validators",
  },
};

const PA_TEMPLATES: Record<string, PluginTemplate> = {
  "rule": {
    pluginType: "rule",
    sdk: "pingaccess",
    interfaceName: "RuleInterceptorBase",
    descriptorClass: "@Rule",
    imports: [
      "com.pingidentity.pa.sdk.policy.RuleInterceptorBase",
      "com.pingidentity.pa.sdk.policy.Rule",
      "com.pingidentity.pa.sdk.interceptor.Outcome",
      "com.pingidentity.pa.sdk.http.Exchange",
    ],
    constructorPattern: "@Rule(type, label, expectedConfiguration)",
    configurePattern: "@UIElement",
    mainMethodSignature: "public Outcome handleRequest(Exchange exchange)",
    mainMethodBody: "// DaVinci logic translated here",
    pfInfType: "com.pingidentity.pa.sdk.policy.RuleInterceptor",
  },
  "identity-mapping": {
    pluginType: "identity-mapping",
    sdk: "pingaccess",
    interfaceName: "IdentityMappingPluginBase",
    descriptorClass: "@IdentityMapping",
    imports: [
      "com.pingidentity.pa.sdk.identitymapping.IdentityMappingPluginBase",
      "com.pingidentity.pa.sdk.identitymapping.IdentityMapping",
      "com.pingidentity.pa.sdk.identity.Identity",
      "com.pingidentity.pa.sdk.http.Exchange",
    ],
    constructorPattern: "@IdentityMapping(label, type, expectedConfiguration)",
    configurePattern: "@UIElement",
    mainMethodSignature: "public Identity mapIdentity(Exchange exchange, Identity identity)",
    mainMethodBody: "// DaVinci logic translated here",
    pfInfType: "com.pingidentity.pa.sdk.identitymapping.IdentityMappingPlugin",
  },
  "load-balancing": {
    pluginType: "load-balancing",
    sdk: "pingaccess",
    interfaceName: "LoadBalancingPluginBase",
    descriptorClass: "@LoadBalancingStrategy",
    imports: [
      "com.pingidentity.pa.sdk.ha.lb.LoadBalancingPluginBase",
      "com.pingidentity.pa.sdk.ha.lb.LoadBalancingStrategy",
    ],
    constructorPattern: "@LoadBalancingStrategy(label, type, expectedConfiguration)",
    configurePattern: "@UIElement",
    mainMethodSignature: "// Handler pattern — see LoadBalancingPluginBase docs",
    mainMethodBody: "// DaVinci logic translated here",
    pfInfType: "com.pingidentity.pa.sdk.ha.lb.LoadBalancingPlugin",
  },
};

// ── Public API ────────────────────────────────────────────────────────

export function getTemplate(
  pluginType: string,
  sdk: "pingfederate" | "pingaccess",
): PluginTemplate | undefined {
  if (sdk === "pingaccess") {
    return PA_TEMPLATES[pluginType];
  }
  return PF_TEMPLATES[pluginType];
}

export function listTemplates(
  sdk: "pingfederate" | "pingaccess",
): PluginTemplate[] {
  if (sdk === "pingaccess") {
    return Object.values(PA_TEMPLATES);
  }
  return Object.values(PF_TEMPLATES);
}

export function renderTemplate(
  template: PluginTemplate,
  context: TemplateContext,
): string {
  if (template.sdk === "pingaccess") {
    return renderPingAccessTemplate(template, context);
  }
  return renderPingFederateTemplate(template, context);
}

// ── PingFederate Renderer ─────────────────────────────────────────────

function renderPingFederateTemplate(
  template: PluginTemplate,
  ctx: TemplateContext,
): string {
  const importsBlock = template.imports
    .map((i) => `import ${i};`)
    .join("\n");

  const contractEntries = ctx.attributeContract
    .map((a) => `        contract.add("${a}");`)
    .join("\n");

  return `package ${ctx.packageName};

${importsBlock}

public class ${ctx.className} implements ${template.interfaceName} {

    private static final String NAME = "${ctx.pluginName}";
    private ${template.descriptorClass} descriptor;

    // Configuration fields
${ctx.guiFields || "    // No GUI fields"}

    public ${ctx.className}() {
        AdapterConfigurationGuiDescriptor guiDescriptor = new AdapterConfigurationGuiDescriptor(NAME);
${ctx.guiFields || "        // No GUI fields to add"}

        Set<String> contract = new HashSet<>();
${contractEntries || "        // No attributes in contract"}

        descriptor = new ${template.descriptorClass}(this, NAME, contract, false, guiDescriptor, false);
    }

    @Override
    public void configure(Configuration configuration) {
${ctx.configureBody || "        // No configuration"}
    }

    @Override
    public ${template.descriptorClass} getPluginDescriptor() {
        return descriptor;
    }

    @Override
    ${template.mainMethodSignature} {
${ctx.mainMethodBody || "        " + template.mainMethodBody}
    }
}
`;
}

// ── PingAccess Renderer ───────────────────────────────────────────────

function renderPingAccessTemplate(
  template: PluginTemplate,
  ctx: TemplateContext,
): string {
  const importsBlock = template.imports
    .map((i) => `import ${i};`)
    .join("\n");

  return `package ${ctx.packageName};

${importsBlock}

${template.descriptorClass}(
    label = "${ctx.pluginName}",
    type = "${ctx.className}"
)
public class ${ctx.className} extends ${template.interfaceName}<${ctx.className}Configuration> {

    @Override
    ${template.mainMethodSignature} {
${ctx.mainMethodBody || "        " + template.mainMethodBody}
    }

    public static class ${ctx.className}Configuration {
${ctx.guiFields || "        // No configuration fields"}
    }
}
`;
}
