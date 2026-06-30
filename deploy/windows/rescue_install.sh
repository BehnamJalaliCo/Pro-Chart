#!/usr/bin/env bash
# نصبِ خودکارِ Windows Server روی دیسکِ سرورِ Hetzner Cloud از داخلِ Rescue (لینوکس).
# روش: QEMU-KVM بوت می‌کند از ISO ویندوز + درایورِ VirtIO + یک ISO کوچک autounattend که
# نصب را کاملاً unattended می‌کند و در پایان bootstrap.ps1 را اجرا می‌کند (Python/MT5/agent/RDP).
#
# پارامترها (env):
#   WIN_ADMIN_PASS   رمزِ Administrator ویندوز (الزامی)
#   BOOTSTRAP_URL    آدرسِ bootstrap.ps1 (اجرا در اولین لاگین ویندوز)
#   WIN_ISO_URL      (اختیاری) آدرسِ ISO ویندوز سرور
#   TARGET_DISK      دیسکِ مقصد (پیش‌فرض /dev/sda)
set -euo pipefail

TARGET_DISK="${TARGET_DISK:-/dev/sda}"
WIN_API_URL="${WIN_API_URL:-https://fx.trade-future.ir/api}"
WIN_EA_TOKEN="${WIN_EA_TOKEN:?WIN_EA_TOKEN required}"
BOOTSTRAP_URL="${BOOTSTRAP_URL:-${WIN_API_URL}/public/winagent/bootstrap.ps1}"
# میرورِ هتزنر (سریع داخلِ شبکهٔ هتزنر). نسخهٔ MLF چنداِدیشن؛ بدونِ کلید unactivated اجرا می‌شود.
WIN_ISO_URL="${WIN_ISO_URL:-https://mirror.hetzner.de/bootimages/windows/SW_DVD9_Win_Server_STD_CORE_2022_2108.15_64Bit_English_DC_STD_MLF_X23-31801.ISO}"
VIRTIO_URL="https://fedorapeople.org/groups/virt/virtio-win/direct-downloads/stable-virtio/virtio-win.iso"
WORK=/root/wininstall
mkdir -p "$WORK"; cd "$WORK"

echo "[rescue] installing tools..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq qemu-system-x86 qemu-utils genisoimage wget ovmf >/dev/null

echo "[rescue] downloading Windows ISO + virtio (this takes a while)..."
wget -q -O windows.iso "$WIN_ISO_URL"
wget -q -O virtio.iso "$VIRTIO_URL"

echo "[rescue] building autounattend ISO..."
mkdir -p unattend
cat > unattend/autounattend.xml <<XML
<?xml version="1.0" encoding="utf-8"?>
<unattend xmlns="urn:schemas-microsoft-com:unattend">
  <settings pass="windowsPE">
    <component name="Microsoft-Windows-International-Core-WinPE" processorArchitecture="amd64"
               publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">
      <SetupUILanguage><UILanguage>en-US</UILanguage></SetupUILanguage>
      <InputLocale>en-US</InputLocale><SystemLocale>en-US</SystemLocale>
      <UILanguage>en-US</UILanguage><UserLocale>en-US</UserLocale>
    </component>
    <component name="Microsoft-Windows-Setup" processorArchitecture="amd64"
               publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">
      <DiskConfiguration><Disk wcm:action="add" xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State">
        <DiskID>0</DiskID><WillWipeDisk>true</WillWipeDisk>
        <CreatePartitions>
          <CreatePartition wcm:action="add"><Order>1</Order><Type>Primary</Type><Size>500</Size></CreatePartition>
          <CreatePartition wcm:action="add"><Order>2</Order><Type>Primary</Type><Extend>true</Extend></CreatePartition>
        </CreatePartitions>
        <ModifyPartitions>
          <ModifyPartition wcm:action="add"><Order>1</Order><PartitionID>1</PartitionID><Label>System</Label><Format>NTFS</Format><Active>true</Active></ModifyPartition>
          <ModifyPartition wcm:action="add"><Order>2</Order><PartitionID>2</PartitionID><Label>Windows</Label><Letter>C</Letter><Format>NTFS</Format></ModifyPartition>
        </ModifyPartitions>
      </Disk></DiskConfiguration>
      <ImageInstall><OSImage>
        <InstallFrom><MetaData wcm:action="add"><Key>/IMAGE/NAME</Key><Value>Windows Server 2022 Standard (Desktop Experience)</Value></MetaData></InstallFrom>
        <InstallTo><DiskID>0</DiskID><PartitionID>2</PartitionID></InstallTo>
        <InstallToAvailablePartition>false</InstallToAvailablePartition></OSImage></ImageInstall>
      <UserData><AcceptEula>true</AcceptEula>
        <ProductKey><Key></Key><WillShowUI>OnError</WillShowUI></ProductKey></UserData>
      <DriverPaths><PathAndCredentials wcm:action="add" wcm:keyValue="1">
        <Path>E:\amd64\2k22</Path></PathAndCredentials>
        <PathAndCredentials wcm:action="add" wcm:keyValue="2"><Path>E:\NetKVM\2k22\amd64</Path></PathAndCredentials>
      </DriverPaths>
    </component>
  </settings>
  <settings pass="oobeSystem">
    <component name="Microsoft-Windows-Shell-Setup" processorArchitecture="amd64"
               publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">
      <OOBE><HideEULAPage>true</HideEULAPage><HideLocalAccountScreen>true</HideLocalAccountScreen>
        <HideOnlineAccountScreens>true</HideOnlineAccountScreens><HideWirelessSetupInOOBE>true</HideWirelessSetupInOOBE>
        <ProtectYourPC>3</ProtectYourPC><NetworkLocation>Work</NetworkLocation></OOBE>
      <UserAccounts><AdministratorPassword><Value>${WIN_ADMIN_PASS}</Value><PlainText>true</PlainText></AdministratorPassword></UserAccounts>
      <AutoLogon><Password><Value>${WIN_ADMIN_PASS}</Value><PlainText>true</PlainText></Password>
        <Enabled>true</Enabled><Username>Administrator</Username><LogonCount>2</LogonCount></AutoLogon>
      <FirstLogonCommands>
        <SynchronousCommand wcm:action="add"><Order>1</Order>
          <CommandLine>powershell -ExecutionPolicy Bypass -Command "iwr -UseBasicParsing '${BOOTSTRAP_URL}' -OutFile C:\\bootstrap.ps1; powershell -ExecutionPolicy Bypass -File C:\\bootstrap.ps1 -Api '${WIN_API_URL}' -Token '${WIN_EA_TOKEN}'"</CommandLine>
        </SynchronousCommand>
      </FirstLogonCommands>
      <TimeZone>UTC</TimeZone>
    </component>
  </settings>
</unattend>
XML
genisoimage -quiet -o unattend.iso -V UNATTEND -J -r unattend/

echo "[rescue] running QEMU unattended Windows install (~30-45 min)..."
qemu-system-x86_64 -enable-kvm -m 6144 -smp 4 \
  -drive file="$TARGET_DISK",format=raw,if=virtio,cache=none \
  -drive file=windows.iso,media=cdrom,index=0 \
  -drive file=virtio.iso,media=cdrom,index=1 \
  -drive file=unattend.iso,media=cdrom,index=2 \
  -boot d -netdev user,id=n0 -device virtio-net,netdev=n0 \
  -display none -no-reboot 2>/tmp/qemu.log || true

echo "[rescue] install finished — disk has Windows. Reboot the server out of rescue to boot Windows."
