package referrer

// The installed Expo callback is compiled unchanged; only its external boundaries are simulated.
class RemoteException : Exception()

class Promise {
  var resolutions = 0
  var rejections = 0
  var value: String? = null
  var code: String? = null
  fun resolve(value: String) {
    resolutions++
    this.value = value
  }
  fun reject(code: String, message: String, cause: Throwable?) {
    rejections++
    this.code = code
  }
}

interface InstallReferrerStateListener {
  fun onInstallReferrerSetupFinished(responseCode: Int)
  fun onInstallReferrerServiceDisconnected()
}

class ReferrerDetails(val installReferrer: String)

class InstallReferrerClient(val remoteFailure: Boolean = false) {
  companion object {
    lateinit var next: InstallReferrerClient
    fun newBuilder(context: Unit) = Builder()
  }
  class Builder { fun build() = next }
  object InstallReferrerResponse {
    const val OK = 0
    const val SERVICE_UNAVAILABLE = 1
    const val FEATURE_NOT_SUPPORTED = 2
  }
  lateinit var listener: InstallReferrerStateListener
  var closed = false
  var closes = 0
  val installReferrer: ReferrerDetails
    get() {
      if (remoteFailure) throw RemoteException()
      return ReferrerDetails("synthetic-referrer")
    }
  fun startConnection(listener: InstallReferrerStateListener) { this.listener = listener }
  fun endConnection() {
    closed = true
    closes++
  }
}

fun main() {
  for ((remoteFailure, response, expectedCode) in listOf(
    Triple(true, 0, "ERR_APPLICATION_INSTALL_REFERRER_REMOTE_EXCEPTION"),
    Triple(false, 0, null),
    Triple(false, 1, "ERR_APPLICATION_INSTALL_REFERRER"),
    Triple(false, 2, "ERR_APPLICATION_INSTALL_REFERRER_UNAVAILABLE"),
    Triple(false, 3, "ERR_APPLICATION_INSTALL_REFERRER")
  )) {
    val client = InstallReferrerClient(remoteFailure)
    InstallReferrerClient.next = client
    val promise = Promise()
    captureReferrer(promise)
    check(!client.closed) { "Connection must remain open until setup completes" }
    client.listener.onInstallReferrerSetupFinished(response)
    check(client.closed) { "Connection left open: remoteFailure=$remoteFailure response=$response" }
    check(promise.code == expectedCode) { "Error code changed" }
    check(promise.resolutions == if (expectedCode == null) 1 else 0)
    check(promise.rejections == if (expectedCode == null) 0 else 1)
    check(promise.value == if (expectedCode == null) "synthetic-referrer" else null)
    client.listener.onInstallReferrerSetupFinished(response)
    client.listener.onInstallReferrerServiceDisconnected()
    check(client.closes == 1 && promise.resolutions + promise.rejections == 1) {
      "Duplicate callbacks must not settle or close again"
    }
  }
  println("Install-referrer cleanup: remote failure, success, response errors and duplicate callbacks passed")
}
