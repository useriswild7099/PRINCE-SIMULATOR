@echo off
title 8085 Jubin Simulator Launcher
color 0B
echo ====================================================================
echo                 8085 JUBIN SIMULATOR LAUNCHER
echo ====================================================================
echo.

set "JAVA_EXE="

:: 1. Check if java is available in system PATH
where java >nul 2>nul
if %errorlevel% equ 0 (
    set "JAVA_EXE=java"
    goto :START_SIMULATOR
)

echo [STATUS] Java not found in system PATH.
echo [STATUS] Searching common installation directories for Java...
echo.

:: 2. Check the specific JRE we found on your system
if exist "C:\Program Files\Java\jre1.8.0_491\bin\java.exe" (
    set "JAVA_EXE=C:\Program Files\Java\jre1.8.0_491\bin\java.exe"
    goto :START_SIMULATOR
)

:: 3. Dynamically search in C:\Program Files\Java\
if exist "C:\Program Files\Java" (
    for /d %%d in ("C:\Program Files\Java\*") do (
        if exist "%%d\bin\java.exe" (
            set "JAVA_EXE=%%d\bin\java.exe"
            goto :START_SIMULATOR
        )
    )
)

:: 4. Dynamically search in C:\Program Files (x86)\Java\
if exist "C:\Program Files (x86)\Java" (
    for /d %%d in ("C:\Program Files (x86)\Java\*") do (
        if exist "%%d\bin\java.exe" (
            set "JAVA_EXE=%%d\bin\java.exe"
            goto :START_SIMULATOR
        )
    )
)

:: 5. Dynamically search in C:\Program Files\Eclipse Adoptium\ (Common openJDK path)
if exist "C:\Program Files\Eclipse Adoptium" (
    for /d %%d in ("C:\Program Files\Eclipse Adoptium\*") do (
        if exist "%%d\bin\java.exe" (
            set "JAVA_EXE=%%d\bin\java.exe"
            goto :START_SIMULATOR
        )
    )
)

:: If all searches failed
color 0C
echo [ERROR] Java Runtime Environment (JRE/JDK) was not found on your system!
echo.
echo The 8085 Simulator is a Java-based application and requires Java to run.
echo.
echo How to fix this:
echo 1. Download and install the latest Java LTS (e.g., Eclipse Temurin 17 or 21).
echo    Direct Link: https://adoptium.net/
echo 2. During installation, make sure "Add to PATH" is checked.
echo 3. After installation, restart your terminal or reopen this file.
echo.
echo Opening the Adoptium Java download page in your web browser...
start https://adoptium.net/
echo.
echo Press any key to exit.
pause >nul
exit /b 1

:START_SIMULATOR
echo [SUCCESS] Java JRE detected at:
echo           "%JAVA_EXE%"
echo.
echo [STATUS] Launching 8085 Simulator by Jubin Mitra...
echo.
start "" "%JAVA_EXE%" -jar "%~dp08085Compiler.jar"
exit /b 0
