rootProject.name = "presence"

plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
    kotlin("jvm") version "2.3.0" apply false
    kotlin("plugin.spring") version "2.3.0" apply false
    id("org.springframework.boot") version "4.0.5" apply false
    id("io.spring.dependency-management") version "1.1.7" apply false
}
