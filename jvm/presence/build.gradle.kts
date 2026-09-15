import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

plugins {
    kotlin("jvm") version "2.3.0"
    kotlin("plugin.spring") version "2.3.0"
    id("org.springframework.boot") version "4.0.5"
    id("io.spring.dependency-management") version "1.1.7"
}

group = "pt.pse.presence"
version = "0.1.0"

// Exposes the build version on the status endpoint, so the running API can be told
// apart from the bundle the browser is holding.
springBoot {
    buildInfo()
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-jdbc")

    implementation("tools.jackson.module:jackson-module-kotlin:3.1.1")
    implementation("org.jetbrains.kotlin:kotlin-reflect:2.3.0")

    // JDBI, not JPA. See AGENTS.md section 1.
    implementation("org.jdbi:jdbi3-core:3.51.0")
    implementation("org.jdbi:jdbi3-kotlin:3.51.0")
    implementation("org.jdbi:jdbi3-postgres:3.51.0")
    implementation("org.postgresql:postgresql:42.7.9")

    // BCrypt only. The full spring-boot-starter-security would put a filter chain in
    // front of every request, which is not how this application authenticates.
    implementation("org.springframework.security:spring-security-crypto")

    // Reads the vacation spreadsheet.
    implementation("org.apache.poi:poi-ooxml:5.3.0")

    developmentOnly("org.springframework.boot:spring-boot-devtools")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation(kotlin("test"))
    testImplementation("org.jetbrains.kotlin:kotlin-test-junit5:2.3.0")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher:6.0.2")
}

kotlin {
    jvmToolchain(25)
    compilerOptions {
        freeCompilerArgs.addAll("-Xjsr305=strict")
    }
}

tasks.withType<Test> {
    useJUnitPlatform()
}

val compileKotlin: KotlinCompile by tasks
compileKotlin.compilerOptions {
    freeCompilerArgs.set(listOf("-Xannotation-default-target=param-property"))
}
