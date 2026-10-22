/* Package-local interpreter shim. No PATH lookup, shell or developer fallback. */
#include <mach-o/dyld.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
int main(void) {
    char executable[PATH_MAX], resolved[PATH_MAX], python[PATH_MAX], entry[PATH_MAX];
    uint32_t size = sizeof(executable);
    if (_NSGetExecutablePath(executable, &size) || !realpath(executable, resolved)) return 70;
    char *slash = strrchr(resolved, '/'); if (!slash) return 70; *slash = 0;
    slash = strrchr(resolved, '/'); if (!slash) return 70; *slash = 0;
    int n = snprintf(python, sizeof(python), "%s/Frameworks/Python/bin/python3", resolved);
    int m = snprintf(entry, sizeof(entry), "%s/Resources/MusicStudioEngine/code/native_launch.py", resolved);
    if (n < 0 || m < 0 || n >= sizeof(python) || m >= sizeof(entry)) return 70;
    char *args[] = {python, "-I", "-B", entry, NULL};
    execv(python, args);
    perror("Music Studio packaged runtime refused");
    return 71;
}
