import type { PluginGenerationConfig } from "./davinci-types.js";

export type TargetSdk = "pingfederate" | "pingaccess";

export function generatePom(
  config: PluginGenerationConfig,
  targetSdk: TargetSdk,
): string {
  if (targetSdk === "pingaccess") {
    return generatePingAccessPom(config);
  }
  return generatePingFederatePom(config);
}

// ── PingFederate POM ──────────────────────────────────────────────────

function generatePingFederatePom(config: PluginGenerationConfig): string {
  const sdkPath = config.sdkPath ?? "${project.basedir}/sdk/lib";

  return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>${config.packageName}</groupId>
    <artifactId>${config.pluginName}</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>
    <name>PingFederate Plugin :: ${config.className}</name>

    <properties>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>

    <dependencies>
        <dependency>
            <groupId>com.pingidentity</groupId>
            <artifactId>pf-sdk</artifactId>
            <version>1.0.0</version>
            <scope>system</scope>
            <systemPath>${sdkPath}/servlet-api.jar</systemPath>
        </dependency>
        <dependency>
            <groupId>com.pingidentity</groupId>
            <artifactId>pf-tasks</artifactId>
            <version>1.0.0</version>
            <scope>system</scope>
            <systemPath>${sdkPath}/tasks.jar</systemPath>
        </dependency>
    </dependencies>


    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.11.0</version>
                <configuration>
                    <source>${config.javaVersion}</source>
                    <target>${config.javaVersion}</target>
                </configuration>
            </plugin>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-jar-plugin</artifactId>
                <version>3.3.0</version>
                <configuration>
                    <archive>
                        <addMavenDescriptor>false</addMavenDescriptor>
                    </archive>
                </configuration>
            </plugin>
        </plugins>
        <resources>
            <resource>
                <directory>src/main/resources</directory>
                <includes>
                    <include>PF-INF/**</include>
                </includes>
            </resource>
        </resources>
    </build>
</project>
`;
}

// ── PingAccess POM ────────────────────────────────────────────────────

function generatePingAccessPom(config: PluginGenerationConfig): string {
  const javaVersion = config.javaVersion === "11" ? "17" : config.javaVersion;

  return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.pingidentity.pingaccess</groupId>
    <artifactId>${config.pluginName}</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>
    <name>PingAccess Plugin :: ${config.className}</name>

    <properties>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <project.reporting.outputEncoding>UTF-8</project.reporting.outputEncoding>
        <javac.source>${javaVersion}</javac.source>
        <javac.target>${javaVersion}</javac.target>
        <jar.to.copy>target/\${project.build.finalName}.\${project.packaging}</jar.to.copy>
        <jar.destination>../../../deploy</jar.destination>
    </properties>

    <repositories>
        <repository>
            <releases>
                <enabled>true</enabled>
                <updatePolicy>always</updatePolicy>
                <checksumPolicy>warn</checksumPolicy>
            </releases>
            <id>PingIdentityMaven</id>
            <name>PingIdentity Release</name>
            <url>https://maven.pingidentity.com/release/</url>
            <layout>default</layout>
        </repository>
    </repositories>

    <dependencies>
        <dependency>
            <groupId>com.pingidentity.pingaccess</groupId>
            <artifactId>pingaccess-sdk</artifactId>
            <version>9.0.1.0</version>
        </dependency>
        <dependency>
            <groupId>jakarta.validation</groupId>
            <artifactId>jakarta.validation-api</artifactId>
            <version>3.1.1</version>
        </dependency>
        <dependency>
            <groupId>jakarta.inject</groupId>
            <artifactId>jakarta.inject-api</artifactId>
            <version>2.0.1</version>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>2.5.1</version>
                <configuration>
                    <source>${javaVersion}</source>
                    <target>${javaVersion}</target>
                </configuration>
            </plugin>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-antrun-plugin</artifactId>
                <version>1.7</version>
                <executions>
                    <execution>
                        <phase>install</phase>
                        <goals>
                            <goal>run</goal>
                        </goals>
                        <configuration>
                            <target>
                                <copy todir="\${jar.destination}">
                                    <fileset file="\${jar.to.copy}" />
                                </copy>
                            </target>
                        </configuration>
                    </execution>
                </executions>
            </plugin>
            <plugin>
                <artifactId>maven-surefire-plugin</artifactId>
                <version>2.18</version>
                <configuration>
                    <argLine>
                        --add-opens java.base/java.lang=ALL-UNNAMED
                    </argLine>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
`;
}
