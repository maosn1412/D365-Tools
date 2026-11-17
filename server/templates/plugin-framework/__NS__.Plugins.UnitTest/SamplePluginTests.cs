using System;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Moq;
using {{NamespacePrefix}}.Plugins.Sample.Domain.Sample;

namespace {{NamespacePrefix}}.Plugins.UnitTest
{
    /// <summary>
    /// 示例插件单元测试：演示如何用 Moq 构造 IServiceProvider 执行插件。
    /// 注意：PluginContext 构造函数会查询 usersettings 获取语言，
    /// 这里让 RetrieveMultiple 返回空集合，框架会回退到默认语言 2052。
    /// </summary>
    [TestClass]
    public class SamplePluginTests
    {
        private Mock<IServiceProvider> _serviceProvider;
        private Mock<IPluginExecutionContext> _context;
        private Mock<ITracingService> _tracing;
        private Mock<IOrganizationServiceFactory> _factory;
        private Mock<IOrganizationService> _service;
        private Entity _target;

        [TestInitialize]
        public void Setup()
        {
            _serviceProvider = new Mock<IServiceProvider>();
            _context = new Mock<IPluginExecutionContext>();
            _tracing = new Mock<ITracingService>();
            _factory = new Mock<IOrganizationServiceFactory>();
            _service = new Mock<IOrganizationService>();

            _target = new Entity("{{PublisherPrefix}}_sample") { Id = Guid.NewGuid() };

            _context.SetupGet(c => c.InputParameters).Returns(new ParameterCollection { { "Target", _target } });
            _context.SetupGet(c => c.MessageName).Returns("Create");
            _context.SetupGet(c => c.Stage).Returns(20); // PreOperation
            _context.SetupGet(c => c.UserId).Returns(Guid.NewGuid());
            _context.SetupGet(c => c.PreEntityImages).Returns(new EntityImageCollection());
            _context.SetupGet(c => c.PostEntityImages).Returns(new EntityImageCollection());

            _service.Setup(s => s.RetrieveMultiple(It.IsAny<QueryBase>())).Returns(new EntityCollection());
            _factory.Setup(f => f.CreateOrganizationService(It.IsAny<Guid?>())).Returns(_service.Object);

            _serviceProvider.Setup(p => p.GetService(typeof(IPluginExecutionContext))).Returns(_context.Object);
            _serviceProvider.Setup(p => p.GetService(typeof(ITracingService))).Returns(_tracing.Object);
            _serviceProvider.Setup(p => p.GetService(typeof(IOrganizationServiceFactory))).Returns(_factory.Object);
        }

        [TestMethod]
        public void Create_PreOperation_FillsNameWhenEmpty()
        {
            new Plugin().Execute(_serviceProvider.Object);

            Assert.IsTrue(_target.Contains("{{PublisherPrefix}}_name"));
            StringAssert.StartsWith(_target.GetAttributeValue<string>("{{PublisherPrefix}}_name"), "Sample-");
        }

        [TestMethod]
        public void Create_PreOperation_KeepsExistingName()
        {
            _target["{{PublisherPrefix}}_name"] = "Existing";

            new Plugin().Execute(_serviceProvider.Object);

            Assert.AreEqual("Existing", _target.GetAttributeValue<string>("{{PublisherPrefix}}_name"));
        }
    }
}
