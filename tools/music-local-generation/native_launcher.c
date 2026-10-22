/* Package-local interpreter shim. No PATH lookup, shell or developer fallback. */
#include <mach-o/dyld.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#ifndef NOVA_BOOT_SCRIPT
#define NOVA_BOOT_SCRIPT "native_launch.py"
#endif
extern char **environ;
int main(int argc, char **argv) {
    char executable[PATH_MAX], resolved[PATH_MAX], python[PATH_MAX], entry[PATH_MAX];
    uint32_t size = sizeof(executable);
    if (_NSGetExecutablePath(executable, &size) || !realpath(executable, resolved)) return 70;
    char *slash = strrchr(resolved, '/'); if (!slash) return 70; *slash = 0;
    slash = strrchr(resolved, '/'); if (!slash) return 70; *slash = 0;
    int n = snprintf(python, sizeof(python), "%s/Frameworks/Python/bin/python3", resolved);
    int m = snprintf(entry, sizeof(entry), "%s/Resources/MusicStudioEngine/code/%s", resolved, NOVA_BOOT_SCRIPT);
    if (n < 0 || m < 0 || (size_t)n >= sizeof(python) || (size_t)m >= sizeof(entry)) return 70;
    char **args = calloc((size_t)argc + 4, sizeof(char *));
    if (!args) return 70;
    args[0] = python; args[1] = "-I"; args[2] = "-B"; args[3] = entry;
    for (int index = 1; index < argc; ++index) args[index + 3] = argv[index];
    for (size_t index = 0; environ[index]; ) {
        char *value = environ[index];
        if (!strncmp(value, "PYTHON", 6) || !strncmp(value, "DYLD_", 5) ||
            !strncmp(value, "NOVA_MODEL_", 11) || !strncmp(value, "NOVA_SINSY", 10)) {
            char *equal = strchr(value, '=');
            if (!equal) return 70;
            char *name = strndup(value, (size_t)(equal - value));
            if (!name) return 70;
            unsetenv(name); free(name);
        } else ++index;
    }
    setenv("PATH", "/usr/bin:/bin", 1);
    execv(python, args);
    perror("Music Studio packaged runtime refused");
    return 71;
}
